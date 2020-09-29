import 'uplot/dist/uPlot.min.css';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { css } from 'emotion';
import uPlot from 'uplot';
import { useTheme } from '../../themes';
import { buildPlotContext, PlotContext } from './context';
import { buildPlotConfig, pluginLog, preparePlotData, shouldReinitialisePlot } from './utils';
import { usePlotPlugins } from './hooks';
import { PlotProps } from './types';

// uPlot abstraction responsible for plot initialisation, setup and refresh
// Receives a data frame that is x-axis aligned, as of https://github.com/leeoniya/uPlot/tree/master/docs#data-format
// Exposes contexts for plugins registration and uPlot instance access
export const UPlotChart: React.FC<PlotProps> = props => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLDivElement>(null);

  // instance of uPlot, exposed via PlotContext
  const [plotInstance, setPlotInstance] = useState<uPlot>();

  // Array with current plot data points, calculated when data frame is passed to a plot
  // const [plotData, setPlotData] = useState<uPlot.AlignedData>();
  // uPlot config
  const [currentPlotConfig, setCurrentPlotConfig] = useState<uPlot.Options>();

  // uPlot plugins API hook
  const { arePluginsReady, plugins, registerPlugin } = usePlotPlugins();

  // Main function initialising uPlot. If final config is not settled it will do nothing
  // Will destroy existing uPlot instance
  const initPlot = useCallback(() => {
    if (!currentPlotConfig || !canvasRef?.current) {
      return;
    }

    if (plotInstance) {
      pluginLog('uPlot core', false, 'destroying existing instance due to reinitialisation');
      plotInstance.destroy();
    }

    const data = preparePlotData(props.data);

    pluginLog('uPlot core', false, 'initialized with', data, currentPlotConfig);

    setPlotInstance(new uPlot(currentPlotConfig, data, canvasRef.current));
  }, [props, currentPlotConfig, arePluginsReady, canvasRef.current, plotInstance]);

  const hasConfigChanged = useCallback(() => {
    const config = buildPlotConfig(props, props.data, plugins, theme);
    if (!currentPlotConfig) {
      return false;
    }

    return shouldReinitialisePlot(currentPlotConfig, config);
  }, [props, props.data, currentPlotConfig]);

  // Initialise uPlot when config changes
  useEffect(() => {
    if (!currentPlotConfig) {
      return;
    }
    initPlot();
  }, [currentPlotConfig]);

  // Destroy uPlot on when components unmounts
  useEffect(() => {
    return () => {
      if (plotInstance) {
        pluginLog('uPlot core', false, 'destroying existing instance due to unmount');
        plotInstance.destroy();
      }
    };
  }, [plotInstance]);

  // Effect performed when all plugins have registered. Final config is set triggering plot initialisation
  useEffect(() => {
    if (!canvasRef) {
      throw new Error('Cannot render graph without canvas! Render Canvas as a child of Plot component.');
    }

    if (!arePluginsReady) {
      return;
    }

    if (canvasRef.current) {
      setCurrentPlotConfig(buildPlotConfig(props, props.data, plugins, theme));
    }

    return () => {
      if (plotInstance) {
        console.log('uPlot - destroy instance, unmount');
        plotInstance.destroy();
      }
    };
  }, [arePluginsReady]);

  // When data changes try to be clever about config updates, needs some more love
  useEffect(() => {
    const data = preparePlotData(props.data);
    const config = buildPlotConfig(props, props.data, plugins, theme);

    // See if series configs changes, re-initialise if necessary
    // this is a minimal check, need to update for field config cleverness ;)
    if (hasConfigChanged()) {
      setCurrentPlotConfig(config); // will trigger uPlot reinitialisation
      return;
    } else {
      pluginLog('uPlot core', true, 'updating plot data(throttled log!)');
      // If config hasn't changed just update uPlot's data
      plotInstance?.setData(data);
    }
  }, [props.data, props.timeRange]);

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
    return buildPlotContext(registerPlugin, canvasRef, props.data, plotInstance);
  }, [registerPlugin, canvasRef, props.data, plotInstance]);

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
