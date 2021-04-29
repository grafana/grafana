import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import uPlot, { AlignedData, Options } from 'uplot';
import { PlotContext } from './context';
import { DEFAULT_PLOT_CONFIG, pluginLog } from './utils';
import { PlotProps } from './types';
import usePrevious from 'react-use/lib/usePrevious';

/**
 * @internal
 * uPlot abstraction responsible for plot initialisation, setup and refresh
 * Receives a data frame that is x-axis aligned, as of https://github.com/leeoniya/uPlot/tree/master/docs#data-format
 * Exposes contexts for plugins registration and uPlot instance access
 */
export const UPlotChart: React.FC<PlotProps> = (props) => {
  const plotContainer = useRef<HTMLDivElement>(null);
  const plotInstance = useRef<uPlot>();
  const prevProps = usePrevious(props);

  const config = useMemo(() => {
    return {
      ...DEFAULT_PLOT_CONFIG,
      width: props.width,
      height: props.height,
      ms: 1,
      ...props.config.getConfig(),
    } as uPlot.Options;
  }, [props.config]);

  useLayoutEffect(() => {
    if (!plotInstance.current || props.width === 0 || props.height === 0) {
      return;
    }

    pluginLog('uPlot core', false, 'updating size');
    plotInstance.current.setSize({
      width: props.width,
      height: props.height,
    });
  }, [props.width, props.height]);

  // Effect responsible for uPlot updates/initialization logic. It's performed whenever component's props have changed
  useLayoutEffect(() => {
    // 0. Exit early if the component is not ready to initialize uPlot
    if (!plotContainer.current || props.width === 0 || props.height === 0) {
      return;
    }

    // 1. When config is ready and there is no uPlot instance, create new uPlot and return
    if (!plotInstance.current || !prevProps) {
      plotInstance.current = initializePlot(props.data, config, plotContainer.current);
      return;
    }

    // 2. Reinitialize uPlot if config changed
    if (props.config !== prevProps.config) {
      if (plotInstance.current) {
        pluginLog('uPlot core', false, 'destroying instance');
        plotInstance.current.destroy();
      }
      plotInstance.current = initializePlot(props.data, config, plotContainer.current);
      return;
    }

    // 3. Otherwise, assume only data has changed and update uPlot data
    if (props.data !== prevProps.data) {
      pluginLog('uPlot core', false, 'updating plot data(throttled log!)', props.data);
      plotInstance.current.setData(props.data);
    }
  }, [props, config]);

  // When component unmounts, clean the existing uPlot instance
  useEffect(() => () => plotInstance.current?.destroy(), []);

  // Memoize plot context
  const plotCtx = useMemo(() => {
    return {
      getPlot: () => plotInstance.current,
    };
  }, []);

  return (
    <PlotContext.Provider value={plotCtx}>
      <div style={{ position: 'relative' }}>
        <div ref={plotContainer} data-testid="uplot-main-div" />
        {props.children}
      </div>
    </PlotContext.Provider>
  );
};

function initializePlot(data: AlignedData, config: Options, el: HTMLDivElement) {
  pluginLog('UPlotChart: init uPlot', false, 'initialized with', data, config);
  return new uPlot(config, data, el);
}
