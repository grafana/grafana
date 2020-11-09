import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { css } from 'emotion';
import uPlot from 'uplot';
import { usePrevious } from 'react-use';
import { buildPlotContext, PlotContext } from './context';
import { pluginLog, preparePlotData, shouldInitialisePlot } from './utils';
import { usePlotConfig } from './hooks';
import { PlotProps } from './types';

// uPlot abstraction responsible for plot initialisation, setup and refresh
// Receives a data frame that is x-axis aligned, as of https://github.com/leeoniya/uPlot/tree/master/docs#data-format
// Exposes contexts for plugins registration and uPlot instance access
export const UPlotChart: React.FC<PlotProps> = props => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [plotInstance, setPlotInstance] = useState<uPlot>();
  const plotData = useRef<uPlot.AlignedData>();

  // uPlot config API
  const { currentConfig, addSeries, addAxis, addScale, registerPlugin } = usePlotConfig(
    props.width,
    props.height,
    props.timeZone
  );
  const prevConfig = usePrevious(currentConfig);

  const getPlotInstance = useCallback(() => {
    if (!plotInstance) {
      throw new Error("Plot hasn't initialised yet");
    }

    return plotInstance;
  }, [plotInstance]);

  // Callback executed when there was no change in plot config
  const updateData = useCallback(() => {
    if (!plotInstance || !plotData.current) {
      return;
    }
    pluginLog('uPlot core', false, 'updating plot data(throttled log!)', plotData.current);
    // If config hasn't changed just update uPlot's data
    plotInstance.setData(plotData.current);

    if (props.onDataUpdate) {
      props.onDataUpdate(plotData.current);
    }
  }, [plotInstance, props.onDataUpdate]);

  // Destroys previous plot instance when plot re-initialised
  useEffect(() => {
    const currentInstance = plotInstance;
    return () => {
      currentInstance?.destroy();
    };
  }, [plotInstance]);

  useLayoutEffect(() => {
    plotData.current = preparePlotData(props.data);
  }, [props.data]);

  // Decides if plot should update data or re-initialise
  useLayoutEffect(() => {
    // Make sure everything is ready before proceeding
    if (!currentConfig || !plotData.current) {
      return;
    }

    // Do nothing if there is data vs series config mismatch. This may happen when the data was updated and made this
    // effect fire before the config update triggered the effect.
    if (currentConfig.series.length !== plotData.current.length) {
      return;
    }

    if (shouldInitialisePlot(prevConfig, currentConfig)) {
      if (!canvasRef.current) {
        throw new Error('Missing Canvas component as a child of the plot.');
      }
      const instance = initPlot(plotData.current, currentConfig, canvasRef.current);

      if (props.onPlotInit) {
        props.onPlotInit();
      }

      setPlotInstance(instance);
    } else {
      updateData();
    }
  }, [currentConfig, updateData, setPlotInstance, props.onPlotInit]);

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
    return buildPlotContext(
      Boolean(plotInstance),
      canvasRef,
      props.data,
      registerPlugin,
      addSeries,
      addAxis,
      addScale,
      getPlotInstance
    );
  }, [plotInstance, canvasRef, props.data, registerPlugin, addSeries, addAxis, addScale, getPlotInstance]);

  return (
    <PlotContext.Provider value={plotCtx}>
      <div
        className={css`
          position: relative;
          width: ${props.width}px;
          height: ${props.height}px;
        `}
      >
        {props.children}
      </div>
    </PlotContext.Provider>
  );
};

// Main function initialising uPlot. If final config is not settled it will do nothing
function initPlot(data: uPlot.AlignedData, config: uPlot.Options, ref: HTMLDivElement) {
  pluginLog('uPlot core', false, 'initialized with', data, config);
  return new uPlot(config, data, ref);
}
