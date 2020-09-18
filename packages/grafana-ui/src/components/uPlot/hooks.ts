import { useCallback, useState } from 'react';
import { PlotPlugin } from './types';
import { pluginLog } from './utils';

export const usePlotPlugins = () => {
  /**
   * Map of registered plugins (via children)
   * Used to build uPlot plugins config
   */
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
        setPlugins(p => {
          pluginLog(plugin.id, false, 'unregister');
          delete p[plugin.id];
          return {
            ...p,
          };
        });
      };
    },
    [setPlugins]
  );

  return {
    plugins,
    registerPlugin,
  };
};
