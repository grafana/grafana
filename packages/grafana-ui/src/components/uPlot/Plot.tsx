import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import { buildPlotContext, PlotContext } from './context';
import { pluginLog, preparePlotData } from './utils';
import { usePlotConfig } from './hooks';
import { PlotProps } from './types';
import usePrevious from 'react-use/lib/usePrevious';
import isEqual from 'lodash/isEqual';

// uPlot abstraction responsible for plot initialisation, setup and refresh
// Receives a data frame that is x-axis aligned, as of https://github.com/leeoniya/uPlot/tree/master/docs#data-format
// Exposes contexts for plugins registration and uPlot instance access
export const UPlotChart: React.FC<PlotProps> = props => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [plotInstance, setPlotInstance] = useState<uPlot>();
  const plotData = preparePlotData(props.data);
  const previousData = usePrevious(plotData);

  // uPlot config API
  const { currentConfig, registerPlugin } = usePlotConfig(props.width, props.height, props.timeZone, props.config);

  const initializePlot = useCallback(() => {
    if (!currentConfig || !plotData) {
      return;
    }
    if (!canvasRef.current) {
      throw new Error('Missing Canvas component as a child of the plot.');
    }
    const instance = initPlot(plotData, currentConfig, canvasRef.current);

    if (props.onPlotInit) {
      props.onPlotInit();
    }

    setPlotInstance(instance);
  }, [setPlotInstance, currentConfig, props.onPlotInit]);

  const getPlotInstance = useCallback(() => {
    if (!plotInstance) {
      throw new Error("Plot hasn't initialised yet");
    }

    return plotInstance;
  }, [plotInstance]);

  useLayoutEffect(() => {
    if (!isEqual(plotData, previousData)) {
      updateData(plotInstance, plotData);
      if (props.onDataUpdate) {
        props.onDataUpdate(plotData);
      }
    }
  }, [plotData, plotInstance, props.onDataUpdate]);

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
      <div ref={plotCtx.canvasRef} />
      {props.children}
    </PlotContext.Provider>
  );
};

// Main function initialising uPlot. If final config is not settled it will do nothing
function initPlot(data: uPlot.AlignedData, config: uPlot.Options, ref: HTMLDivElement) {
  pluginLog('uPlot core', false, 'initialized with', data, config);
  return new uPlot(config, data, ref);
}

// Callback executed when there was no change in plot config
function updateData(plotInstance?: uPlot, data?: uPlot.AlignedData) {
  if (!plotInstance || !data) {
    return;
  }
  pluginLog('uPlot core', false, 'updating plot data(throttled log!)', data);
  // If config hasn't changed just update uPlot's data
  plotInstance.setData(data);
}
