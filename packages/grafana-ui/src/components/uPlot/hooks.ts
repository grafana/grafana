import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PlotPlugin } from './types';
import { pluginLog } from './utils';
import uPlot, { Options, PaddingSide } from 'uplot';
import { getTimeZoneInfo, TimeZone } from '@grafana/data';
import { usePlotPluginContext } from './context';
import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';
import usePrevious from 'react-use/lib/usePrevious';

export const usePlotPlugins = () => {
  /**
   * Map of registered plugins (via children)
   * Used to build uPlot plugins config
   */
  const [plugins, setPlugins] = useState<Record<string, PlotPlugin>>({});

  // arePluginsReady determines whether or not all plugins has already registered and uPlot should be initialised
  const [arePluginsReady, setPluginsReady] = useState(false);
  const cancellationToken = useRef<number>();
  const isMounted = useRef(false);

  const checkPluginsReady = useCallback(() => {
    if (cancellationToken.current) {
      window.cancelAnimationFrame(cancellationToken.current);
      cancellationToken.current = undefined;
    }

    /**
     * After registering plugin let's wait for all code to complete to set arePluginsReady to true.
     * If any other plugin will try to register, the previously scheduled call will be canceled
     * and arePluginsReady will be deferred to next animation frame.
     */
    cancellationToken.current = window.requestAnimationFrame(function () {
      if (isMounted.current) {
        setPluginsReady(true);
      }
    });
  }, [cancellationToken, setPluginsReady]);

  const registerPlugin = useCallback(
    (plugin: PlotPlugin) => {
      pluginLog(plugin.id, false, 'register');

      setPlugins((plugs) => {
        if (plugs.hasOwnProperty(plugin.id)) {
          throw new Error(`${plugin.id} that is already registered`);
        }

        return {
          ...plugs,
          [plugin.id]: plugin,
        };
      });
      checkPluginsReady();

      return () => {
        setPlugins((p) => {
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
    isMounted.current = true;
    checkPluginsReady();
    return () => {
      isMounted.current = false;
      if (cancellationToken.current) {
        window.cancelAnimationFrame(cancellationToken.current);
      }
    };
  }, []);

  return {
    arePluginsReady,
    plugins: plugins || {},
    registerPlugin,
  };
};

const paddingSide: PaddingSide = (u, side, sidesWithAxes, cycleNum) => {
  let hasCrossAxis = side % 2 ? sidesWithAxes[0] || sidesWithAxes[2] : sidesWithAxes[1] || sidesWithAxes[3];

  return sidesWithAxes[side] || !hasCrossAxis ? 0 : 8;
};

export const DEFAULT_PLOT_CONFIG: Partial<Options> = {
  focus: {
    alpha: 1,
  },
  cursor: {
    focus: {
      prox: 30,
    },
  },
  legend: {
    show: false,
  },
  padding: [paddingSide, paddingSide, paddingSide, paddingSide],
  series: [],
  hooks: {},
};

export const usePlotConfig = (width: number, height: number, timeZone: TimeZone, configBuilder: UPlotConfigBuilder) => {
  const { arePluginsReady, plugins, registerPlugin } = usePlotPlugins();
  const [isConfigReady, setIsConfigReady] = useState(false);

  const currentConfig = useRef<Options>();
  const tzDate = useMemo(() => {
    let fmt = undefined;

    const tz = getTimeZoneInfo(timeZone, Date.now())?.ianaName;

    if (tz) {
      fmt = (ts: number) => uPlot.tzDate(new Date(ts), tz);
    }

    return fmt;
  }, [timeZone]);

  useLayoutEffect(() => {
    if (!arePluginsReady) {
      return;
    }
    currentConfig.current = {
      ...DEFAULT_PLOT_CONFIG,
      width,
      height,
      ms: 1,
      plugins: Object.entries(plugins).map((p) => ({
        hooks: p[1].hooks,
      })),
      tzDate,
      ...configBuilder.getConfig(),
    };

    setIsConfigReady(true);
  }, [arePluginsReady, plugins, width, height, tzDate, configBuilder]);

  return {
    isConfigReady,
    registerPlugin,
    currentConfig,
  };
};

/**
 * Forces re-render of a component when uPlots's draw hook is fired.
 * This hook is usefull in scenarios when you want to reposition XYCanvas elements when i.e. plot size changes
 * @param pluginId - id under which the plugin will be registered
 */
export const useRefreshAfterGraphRendered = (pluginId: string) => {
  const pluginsApi = usePlotPluginContext();
  const [renderToken, setRenderToken] = useState(0);

  useEffect(() => {
    const unregister = pluginsApi.registerPlugin({
      id: pluginId,
      hooks: {
        // refresh events when uPlot draws
        draw: () => {
          setRenderToken((c) => c + 1);
          return;
        },
      },
    });

    return () => {
      unregister();
    };
  }, []);

  return renderToken;
};

export function useRevision<T>(dep?: T | null, cmp?: (prev?: T | null, next?: T | null) => boolean) {
  const [rev, setRev] = useState(0);
  const prevDep = usePrevious(dep);
  const comparator = cmp ? cmp : (a?: T | null, b?: T | null) => a === b;

  useLayoutEffect(() => {
    const hasChange = !comparator(prevDep, dep);
    if (hasChange) {
      setRev((r) => r + 1);
    }
  }, [dep]);

  return rev;
}
