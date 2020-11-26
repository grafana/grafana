import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import uPlot, { AlignedData, AlignedDataWithGapTest } from 'uplot';
import { buildPlotContext, PlotContext } from './context';
import { pluginLog } from './utils';
import { usePlotConfig } from './hooks';
import { PlotProps } from './types';
import { DataFrame, FieldType } from '@grafana/data';
import isNumber from 'lodash/isNumber';
import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';
import usePrevious from 'react-use/lib/usePrevious';

// uPlot abstraction responsible for plot initialisation, setup and refresh
// Receives a data frame that is x-axis aligned, as of https://github.com/leeoniya/uPlot/tree/master/docs#data-format
// Exposes contexts for plugins registration and uPlot instance access
export const UPlotChart: React.FC<PlotProps> = props => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const plotInstance = useRef<uPlot>();
  const plotData = useRef<AlignedDataWithGapTest>();
  const prevProps = usePrevious(props);
  // uPlot config API
  const { isConfigReady, currentConfig, registerPlugin } = usePlotConfig(
    props.width,
    props.height,
    props.timeZone,
    props.config
  );

  const prevBuilder = usePrevious(props.config);

  // const currentBuilder = useRef(props.config);
  // const propsRev = useRevision(props.data, (a, b) => isEqual(a, b));
  // const propsRevPrev = usePrevious(propsRev);
  // const confRev = useRevision(currentConfig, (a, b) => a === b);
  // const confRevPrev = usePrevious(confRev);

  const initializePlot = () => {
    if (!currentConfig.current || !plotData) {
      return;
    }
    if (!canvasRef.current) {
      throw new Error('Missing Canvas component as a child of the plot.');
    }

    pluginLog('UPlotChart: init uPlot', false, 'initialized with', plotData.current, currentConfig.current);
    return new uPlot(
      {
        ...currentConfig.current,
        hooks: {
          init: [
            u => {
              u.root.setAttribute('data-testid', 'uplot-root');
            },
          ],
        },
      },
      plotData.current,
      canvasRef.current
    );
  };

  console.log(props);
  const getPlotInstance = useCallback(() => {
    if (!plotInstance.current) {
      throw new Error("Plot hasn't initialised yet");
    }

    return plotInstance.current;
  }, []);

  useLayoutEffect(() => {
    if (!currentConfig.current) {
      console.log('No config yet');
      return;
    }
    if (props.width === 0 || props.height === 0) {
      console.log('wait for size to settle');
      return;
    }
    if (currentConfig.current?.width !== prevProps?.width || currentConfig.current?.height !== prevProps?.height) {
      console.log('update size');
      return;
    }

    if (!plotInstance.current && isConfigReady) {
      console.log('initialize', currentConfig.current);
      plotInstance.current = initializePlot();
      return;
    }

    if (isConfigReady && props.config !== prevBuilder) {
      console.log('reinitialize', currentConfig.current);
      return;
    }

    console.log('updateData');
  }, [props, isConfigReady]);
  //
  // useLayoutEffect(() => {
  //   console.log('PROPS:', propsRev, propsRevPrev, 'CONF:', confRev, confRevPrev);
  //   if (!plotInstance.current) {
  //     console.log('First init');
  //     const instance = initializePlot();
  //     plotInstance.current = instance;
  //     return () => {
  //       instance?.destroy();
  //     };
  //   }
  //
  //   // config has changed, we compare UPlotConfigBuilder instances
  //   if (prevBuilder !== props.config) {
  //     console.log('config update');
  //     plotInstance.current.destroy();
  //     const instance = initializePlot();
  //     plotInstance.current = instance;
  //     return () => {
  //       instance?.destroy();
  //     };
  //   }
  //   console.log('data update');
  //
  //   // otherwise the data has changed
  //   const data = props.data.frame.fields.map(f => f.values.toArray()) as AlignedData;
  //   plotData.current = {
  //     data,
  //     isGap: props.data.isGap,
  //   };
  //   updateData(props.data.frame, props.config, plotInstance.current, data);
  //
  //   return;
  // }, [revUpdate]);

  // Memoize plot context
  const plotCtx = useMemo(() => {
    return buildPlotContext(Boolean(plotInstance.current), canvasRef, props.data, registerPlugin, getPlotInstance);
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
