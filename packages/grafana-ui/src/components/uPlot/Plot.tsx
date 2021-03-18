import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import uPlot, { AlignedData, Options } from 'uplot';
import { buildPlotContext, PlotContext } from './context';
import { pluginLog } from './utils';
import { usePlotConfig } from './hooks';
import { PlotProps } from './types';
import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';
import usePrevious from 'react-use/lib/usePrevious';

/**
 * @internal
 * uPlot abstraction responsible for plot initialisation, setup and refresh
 * Receives a data frame that is x-axis aligned, as of https://github.com/leeoniya/uPlot/tree/master/docs#data-format
 * Exposes contexts for plugins registration and uPlot instance access
 */
export const UPlotChart: React.FC<PlotProps> = (props) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const plotInstance = useRef<uPlot>();
  const [isPlotReady, setIsPlotReady] = useState(false);
  const prevProps = usePrevious(props);
  const { isConfigReady, currentConfig, registerPlugin } = usePlotConfig(props.width, props.height, props.config);

  const getPlotInstance = useCallback(() => {
    return plotInstance.current;
  }, []);

  // Effect responsible for uPlot updates/initialization logic. It's performed whenever component's props have changed
  useLayoutEffect(() => {
    // 0. Exit early if the component is not ready to initialize uPlot
    if (!currentConfig.current || !canvasRef.current || props.width === 0 || props.height === 0) {
      return;
    }

    // 0. Exit if the data set length is different than number of series expected to render
    // This may happen when GraphNG has not synced config yet with the aligned frame. Alignment happens before the render
    // in the getDerivedStateFromProps, while the config creation happens in componentDidUpdate, causing one more render
    // of the UPlotChart if the config needs to be updated.
    if (currentConfig.current.series.length !== props.data.length) {
      return;
    }

    // 1. When config is ready and there is no uPlot instance, create new uPlot and return
    if (isConfigReady && !plotInstance.current) {
      plotInstance.current = initializePlot(props.data, currentConfig.current, canvasRef.current);
      setIsPlotReady(true);
      return;
    }

    // 2. When dimensions have changed, update uPlot size and return
    if (currentConfig.current.width !== prevProps?.width || currentConfig.current.height !== prevProps?.height) {
      pluginLog('uPlot core', false, 'updating size');
      plotInstance.current!.setSize({
        width: currentConfig.current.width,
        height: currentConfig.current?.height,
      });
      return;
    }

    // 3. When config has changed re-initialize plot
    if (isConfigReady && props.config !== prevProps.config) {
      if (plotInstance.current) {
        pluginLog('uPlot core', false, 'destroying instance');
        plotInstance.current.destroy();
      }
      plotInstance.current = initializePlot(props.data, currentConfig.current, canvasRef.current);
      return;
    }

    // 4. Otherwise, assume only data has changed and update uPlot data
    updateData(props.config, props.data, plotInstance.current);
  }, [props, isConfigReady]);

  // When component unmounts, clean the existing uPlot instance
  useEffect(() => () => plotInstance.current?.destroy(), []);

  // Memoize plot context
  const plotCtx = useMemo(() => {
    return buildPlotContext(isPlotReady, canvasRef, props.data, registerPlugin, getPlotInstance);
  }, [plotInstance, canvasRef, props.data, registerPlugin, getPlotInstance, isPlotReady]);

  return (
    <PlotContext.Provider value={plotCtx}>
      <div style={{ position: 'relative' }}>
        <div ref={plotCtx.canvasRef} data-testid="uplot-main-div" />
        {props.children}
      </div>
    </PlotContext.Provider>
  );
};

function initializePlot(data: AlignedData | undefined, config: Options, el: HTMLDivElement) {
  pluginLog('UPlotChart: init uPlot', false, 'initialized with', data, config);
  return new uPlot(config, data, el);
}

function updateData(config: UPlotConfigBuilder, data?: AlignedData | null, plotInstance?: uPlot) {
  if (!plotInstance || !data) {
    return;
  }
  pluginLog('uPlot core', false, 'updating plot data(throttled log!)', data);
  plotInstance.setData(data);
}
