import { useCallback, useEffect, useRef, useState } from 'react';
import { PlotPlugin } from './types';
import { pluginLog } from './utils';

export const usePlotPlugins = () => {
  /**
   * Map of registered plugins (via children)
   * Used to build uPlot plugins config
   */
  const [plugins, setPlugins] = useState<Record<string, PlotPlugin>>({});
  // const registeredPlugins = useRef(0);

  // arePluginsReady determines whether or not all plugins has already registered and uPlot should be initialised
  const [arePluginsReady, setPluginsReady] = useState(false);

  const cancellationToken = useRef<number>();

  const checkPluginsReady = useCallback(() => {
    if (cancellationToken.current) {
      window.cancelAnimationFrame(cancellationToken.current);
    }

    /**
     * After registering plugin let's wait for all code to complete to set arePluginsReady to true.
     * If any other plugin will try to register, the previously scheduled call will be canceled
     * and arePluginsReady will be deferred to next animation frame.
     */
    cancellationToken.current = window.requestAnimationFrame(function() {
      setPluginsReady(true);
    });
  }, [cancellationToken, setPluginsReady]);

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
      checkPluginsReady();

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

  // When uPlot mounts let's check if there are any plugins pending registration
  useEffect(() => {
    checkPluginsReady();
    return () => {
      if (cancellationToken.current) {
        window.cancelAnimationFrame(cancellationToken.current);
      }
    };
  }, []);

  return {
    arePluginsReady,
    plugins,
    registerPlugin,
  };
};
