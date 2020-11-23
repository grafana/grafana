import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import uPlot, { AlignedData, AlignedDataWithGapTest } from 'uplot';
import { buildPlotContext, PlotContext } from './context';
import { pluginLog } from './utils';
import { usePlotConfig } from './hooks';
import { PlotProps } from './types';
import { usePrevious } from 'react-use';
import { DataFrame, FieldType } from '@grafana/data';
import isNumber from 'lodash/isNumber';
import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';

// uPlot abstraction responsible for plot initialisation, setup and refresh
// Receives a data frame that is x-axis aligned, as of https://github.com/leeoniya/uPlot/tree/master/docs#data-format
// Exposes contexts for plugins registration and uPlot instance access
export const UPlotChart: React.FC<PlotProps> = props => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [plotInstance, setPlotInstance] = useState<uPlot>();
  const plotData = useRef<AlignedDataWithGapTest>();
  const previousConfig = usePrevious(props.config);

  // uPlot config API
  const { currentConfig, registerPlugin } = usePlotConfig(props.width, props.height, props.timeZone, props.config);

  const initializePlot = useCallback(() => {
    if (!currentConfig || !plotData) {
      return;
    }
    if (!canvasRef.current) {
      throw new Error('Missing Canvas component as a child of the plot.');
    }

    pluginLog('UPlotChart: init uPlot', false, 'initialized with', plotData.current, currentConfig);
    const instance = new uPlot(currentConfig, plotData.current, canvasRef.current);

    setPlotInstance(instance);
  }, [setPlotInstance, currentConfig]);

  const getPlotInstance = useCallback(() => {
    if (!plotInstance) {
      throw new Error("Plot hasn't initialised yet");
    }

    return plotInstance;
  }, [plotInstance]);

  useLayoutEffect(() => {
    plotData.current = {
      data: props.data.frame.fields.map(f => f.values.toArray()) as AlignedData,
      isGap: props.data.isGap,
    };

    if (plotInstance && previousConfig === props.config) {
      updateData(props.data.frame, props.config, plotInstance, plotData.current.data);
    }
  }, [props.data, props.config]);

  useLayoutEffect(() => {
    initializePlot();
  }, [currentConfig]);

  useEffect(() => {
    const currentInstance = plotInstance;
    return () => {
      currentInstance?.destroy();
    };
  }, [plotInstance]);

  // When size props changed update plot size synchronously
  useLayoutEffect(() => {
    if (plotInstance) {
      plotInstance.setSize({
        width: props.width,
        height: props.height,
      });
    }
  }, [plotInstance, props.width, props.height]);

  // Memoize plot context
  const plotCtx = useMemo(() => {
    return buildPlotContext(Boolean(plotInstance), canvasRef, props.data, registerPlugin, getPlotInstance);
  }, [plotInstance, canvasRef, props.data, registerPlugin, getPlotInstance]);

  return (
    <PlotContext.Provider value={plotCtx}>
      <div ref={plotCtx.canvasRef} data-testid="uplot-main-div" />
      {props.children}
    </PlotContext.Provider>
  );
};

// Callback executed when there was no change in plot config
function updateData(frame: DataFrame, config: UPlotConfigBuilder, plotInstance?: uPlot, data?: AlignedData | null) {
  if (!plotInstance || !data) {
    return;
  }
  pluginLog('uPlot core', false, 'updating plot data(throttled log!)', data);
  updateScales(frame, config, plotInstance);
  // If config hasn't changed just update uPlot's data
  plotInstance.setData(data);
}

function updateScales(frame: DataFrame, config: UPlotConfigBuilder, plotInstance: uPlot) {
  let yRange: [number, number] | undefined = undefined;

  for (let i = 0; i < frame.fields.length; i++) {
    if (frame.fields[i].type !== FieldType.number) {
      continue;
    }
    if (isNumber(frame.fields[i].config.min) && isNumber(frame.fields[i].config.max)) {
      yRange = [frame.fields[i].config.min!, frame.fields[i].config.max!];
      break;
    }
  }

  const scalesConfig = config.getConfig().scales;

  if (scalesConfig && yRange) {
    for (const scale in scalesConfig) {
      if (!scalesConfig.hasOwnProperty(scale)) {
        continue;
      }
      if (scale !== 'x') {
        plotInstance.setScale(scale, { min: yRange[0], max: yRange[1] });
      }
    }
  }
}
