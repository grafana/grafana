import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { css } from 'emotion';
import uPlot from 'uplot';
import { usePrevious } from 'react-use';
import { buildPlotContext, PlotContext } from './context';
import { pluginLog, preparePlotData, shouldReinitialisePlot } from './utils';
import { usePlotConfig } from './hooks';
import { PlotProps } from './types';

// uPlot abstraction responsible for plot initialisation, setup and refresh
// Receives a data frame that is x-axis aligned, as of https://github.com/leeoniya/uPlot/tree/master/docs#data-format
// Exposes contexts for plugins registration and uPlot instance access
export const UPlotChart: React.FC<PlotProps> = props => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [plotInstance, setPlotInstance] = useState<uPlot>();

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

  // Main function initialising uPlot. If final config is not settled it will do nothing
  const initPlot = () => {
    if (!currentConfig || !canvasRef.current) {
      return null;
    }
    const data = preparePlotData(props.data);
    pluginLog('uPlot core', false, 'initialized with', data, currentConfig);
    return new uPlot(currentConfig, data, canvasRef.current);
  };

  // Callback executed when there was no change in plot config
  const updateData = useCallback(() => {
    if (!plotInstance) {
      return;
    }
    const data = preparePlotData(props.data);
    pluginLog('uPlot core', false, 'updating plot data(throttled log!)');
    // If config hasn't changed just update uPlot's data
    plotInstance.setData(data);
  }, [plotInstance, props.data]);

  // Destroys previous plot instance when plot re-initialised
  useEffect(() => {
    const currentInstance = plotInstance;
    return () => {
      currentInstance?.destroy();
    };
  }, [plotInstance]);

  // Decides if plot should update data or re-initialise
  useEffect(() => {
    if (!currentConfig) {
      return;
    }

    if (shouldReinitialisePlot(prevConfig, currentConfig)) {
      const instance = initPlot();
      if (!instance) {
        return;
      }
      setPlotInstance(instance);
    } else {
      updateData();
    }
  }, [props.data, props.timeRange, props.timeZone, currentConfig, setPlotInstance]);

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
