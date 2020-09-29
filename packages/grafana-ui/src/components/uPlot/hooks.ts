import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlotPlugin } from './types';
import { pluginLog } from './utils';
import uPlot from 'uplot';
import { getTimeZoneInfo, TimeZone } from '@grafana/data';

export const usePlotPlugins = () => {
  /**
   * Map of registered plugins (via children)
   * Used to build uPlot plugins config
   */
  const [plugins, setPlugins] = useState<Record<string, PlotPlugin>>({});

  // arePluginsReady determines whether or not all plugins has already registered and uPlot should be initialised
  const [arePluginsReady, setPluginsReady] = useState(false);

  const cancellationToken = useRef<number>();

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
    [setPlugins, plugins]
  );

  // When uPlot mounts let's check if there are any plugins pending registration
  useEffect(() => {
    checkPluginsReady();
    return () => {
      if (cancellationToken.current) {
        window.cancelAnimationFrame(cancellationToken.current);
        cancellationToken.current = undefined;
      }
    };
  }, []);

  return {
    arePluginsReady,
    plugins,
    registerPlugin,
  };
};

export const DEFAULT_PLOT_CONFIG = {
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
  hooks: {},
};
export const usePlotConfig = (width: number, height: number, timeZone: TimeZone) => {
  const { arePluginsReady, plugins, registerPlugin } = usePlotPlugins();
  const [seriesConfig, setSeriesConfig] = useState<uPlot.Series[]>([{}]);
  const [axesConfig, setAxisConfig] = useState<uPlot.Axis[]>([]);
  const [scalesConfig, setScaleConfig] = useState<Record<string, uPlot.Scale>>({});
  const [currentConfig, setCurrentConfig] = useState<uPlot.Options>();

  const tzDate = useMemo(() => {
    let fmt = undefined;

    const tz = getTimeZoneInfo(timeZone, Date.now())?.ianaName;

    if (tz) {
      fmt = (ts: number) => uPlot.tzDate(new Date(ts * 1e3), tz);
    }

    return fmt;
  }, [timeZone]);

  const defaultConfig = useMemo(() => {
    return {
      ...DEFAULT_PLOT_CONFIG,
      width,
      height,
      plugins: Object.entries(plugins).map(p => ({
        hooks: p[1].hooks,
      })),
      tzDate,
    } as any;
  }, [plugins, width, height, tzDate]);

  useEffect(() => {
    if (!arePluginsReady) {
      return;
    }

    setCurrentConfig(() => {
      return {
        ...defaultConfig,
        series: seriesConfig,
        axes: axesConfig,
        scales: scalesConfig,
      };
    });
  }, [arePluginsReady]);

  useEffect(() => {
    setCurrentConfig({
      ...defaultConfig,
      series: seriesConfig,
      axes: axesConfig,
      scales: scalesConfig,
    });
  }, [defaultConfig, seriesConfig, axesConfig, scalesConfig]);

  const addSeries = useCallback(
    (s: uPlot.Series) => {
      let index = 0;
      setSeriesConfig(sc => {
        index = sc.length;
        return [...sc, s];
      });

      return {
        removeSeries: () => {
          setSeriesConfig(c => {
            const tmp = [...c];
            tmp.splice(index);
            return tmp;
          });
        },
        updateSeries: (config: uPlot.Series) => {
          setSeriesConfig(c => {
            const tmp = [...c];
            tmp[index] = config;
            return tmp;
          });
        },
      };
    },
    [setCurrentConfig]
  );

  const addAxis = useCallback(
    (a: uPlot.Axis) => {
      let index = 0;
      setAxisConfig(ac => {
        index = ac.length;
        return [...ac, a];
      });

      return {
        removeAxis: () => {
          setAxisConfig(a => {
            const tmp = [...a];
            tmp.splice(index);
            return tmp;
          });
        },
        updateAxis: (config: uPlot.Axis) => {
          setAxisConfig(a => {
            const tmp = [...a];
            tmp[index] = config;
            return tmp;
          });
        },
      };
    },
    [setAxisConfig]
  );

  const addScale = useCallback(
    (scaleKey: string, s: uPlot.Scale) => {
      let key = scaleKey;

      setScaleConfig(sc => {
        const tmp = { ...sc };
        tmp[key] = s;
        return tmp;
      });

      return {
        removeScale: () => {
          setScaleConfig(sc => {
            const tmp = { ...sc };
            if (tmp[key]) {
              delete tmp[key];
            }
            return tmp;
          });
        },
        updateScale: (config: uPlot.Scale) => {
          setScaleConfig(sc => {
            const tmp = { ...sc };
            if (tmp[key]) {
              tmp[key] = config;
            }
            return tmp;
          });
        },
      };
    },
    [setScaleConfig]
  );

  return {
    addSeries,
    addAxis,
    addScale,
    registerPlugin,
    currentConfig,
  };
};
