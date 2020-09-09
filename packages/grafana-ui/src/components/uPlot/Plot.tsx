import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from 'emotion';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

import { useTheme } from '../../themes';
import { buildPlotContext, PlotContext, PlotPluginsContext } from './context';
import { buildPlotConfig, pluginLog, preparePlotData } from './utils';
import { PlotPlugin, PlotProps } from './types';

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
  // map of registered plugins (via children);
  const [plugins, setPlugins] = useState<Record<string, PlotPlugin>>({});

  const registerPlugin = useCallback(
    (plugin: PlotPlugin) => {
      pluginLog(plugin.id, false, 'register');
      if (plugins.hasOwnProperty(plugin.id)) {
        throw new Error(`${plugin.id} that is already registered`);
      }
      setPlugins(plugs => {
        return {
          ...plugs,
          [plugin.id]: plugin,
        };
      });

      return () => {
        setPlugins(plugs => {
          pluginLog(plugin.id, false, 'unregister');
          delete plugs[plugin.id];
          return {
            ...plugs,
          };
        });
      };
    },
    [setPlugins]
  );

  useEffect(() => {
    // Creates array of datapoints to be consumed by uPLot
    const data = preparePlotData(props.data);
    // Creates series, axes and scales config
    // TODO: use field config
    const config = buildPlotConfig(props, props.data, theme);

    config.plugins = [
      ...config.plugins,
      ...Object.entries(plugins).map(p => ({
        hooks: p[1].hooks,
      })),
    ];

    setConfig(config);
    setPlotData(data);
  }, [props.data, plugins]);

  useEffect(() => {
    if (!config || !plotData) {
      plotInstance?.destroy();
      return;
    }

    if (plotInstance) {
      console.log('uPlot - destroy instance');
      plotInstance.destroy();
    }

    if (canvasRef && canvasRef.current) {
      console.log('Initializing plot', config, plotData);
      setPlotInstance(new uPlot(config, plotData, canvasRef.current));
    }

    return () => {
      if (plotInstance) {
        console.log('uPlot - destroy instance, unmount');
        plotInstance.destroy();
      }
    };
  }, [config]);

  useEffect(() => {
    if (plotInstance) {
      console.log('Updating plot size', props.width, props.height);
      plotInstance.setSize({ width: props.width, height: props.height });
    }
  }, [props.width, props.height]);

  return (
    <PlotPluginsContext.Provider value={{ registerPlugin }}>
      <PlotContext.Provider value={buildPlotContext(plotInstance)}>
        <div
          className={css`
            width: ${props.width}px;
            height: ${props.height}px;
            position: relative;
          `}
        >
          <div title="canvas-ref" ref={canvasRef} />
          {/* render plugins provided as children */}
          {props.children}
        </div>
      </PlotContext.Provider>
    </PlotPluginsContext.Provider>
  );
};
