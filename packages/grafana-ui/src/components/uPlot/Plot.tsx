import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { css } from 'emotion';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

import { useTheme } from '../../themes';
import { buildPlotContext, PlotContext } from './context';
import { buildPlotConfig, preparePlotData } from './utils';
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
  const [plotData, setPlotData] = useState<uPlot.AlignedData>();
  // uPlot config
  const [config, setConfig] = useState<uPlot.Options>();
  // uPlot plugins API hook
  const { plugins, registerPlugin } = usePlotPlugins();

  useEffect(() => {
    if (!canvasRef || !canvasRef.current) {
      return;
    }
    // Creates array of datapoints to be consumed by uPlot
    const data = preparePlotData(props.data);
    // Creates series, axes and scales config
    const config = buildPlotConfig(props, props.data, theme);

    config.plugins = [
      ...config.plugins,
      ...Object.entries(plugins).map(p => ({
        hooks: p[1].hooks,
      })),
    ];

    setConfig(config);
    setPlotData(data);
  }, [props.data, plugins, canvasRef.current]);

  useEffect(() => {
    if (!canvasRef) {
      throw new Error('Cannot render graph without canvas!');
    }

    if (!config || !plotData) {
      plotInstance?.destroy();
      return;
    }

    if (plotInstance) {
      console.log('uPlot - destroy instance');
      plotInstance.destroy();
    }

    if (canvasRef.current) {
      if (config.width === 0 || config.height === 0) {
        console.log(config.width, config.height);
        return;
      }

      console.log('Initializing plot', config, plotData);

      setPlotInstance(new uPlot(config, plotData, canvasRef.current));
    }

    return () => {
      if (plotInstance) {
        console.log('uPlot - destroy instance, unmount');
        plotInstance.destroy();
      }
    };
  }, [config, canvasRef.current]);

  useLayoutEffect(() => {
    if (plotInstance) {
      plotInstance.setSize({
        width: props.width,
        height: props.height,
      });
    }
  }, [props.width, props.height]);

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
