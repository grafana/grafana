import { useEffect, useRef } from 'react';
import uPlot, { type AlignedData, type Options } from 'uplot';

import { type PlotProps } from './types';
import { pluginLog } from './utils';

import 'uplot/dist/uPlot.min.css';

/**
 * @internal
 * uPlot abstraction responsible for plot initialisation, setup and refresh
 * Receives a data frame that is x-axis aligned, as of https://github.com/leeoniya/uPlot/tree/master/docs#data-format
 * Exposes context for uPlot instance access
 */
export function UPlotChart({ data, width, height, config, children, plotRef }: PlotProps) {
  const plotContainer = useRef<HTMLDivElement>(null);
  const plotInstance = useRef<uPlot | null>(null);

  // The two update effects below must stay declared above the initialisation effect.
  // Otherwise they will reapply the plot size and data on mount.
  useEffect(() => {
    plotInstance.current?.setSize({ width: Math.floor(width), height: Math.floor(height) });
  }, [width, height]);

  useEffect(() => {
    plotInstance.current?.setData(data as AlignedData);
  }, [data]);

  useEffect(() => {
    if (width === 0 && height === 0) {
      return;
    }

    const options: Options = {
      width: Math.floor(width),
      height: Math.floor(height),
      ...config.getConfig(),
    };

    pluginLog('UPlot', false, 'Reinitializing plot', options);
    const plot = new uPlot(options, data as AlignedData, plotContainer.current!);

    plotInstance.current = plot;
    plotRef?.(plot);

    return () => {
      plot.destroy();
      plotInstance.current = null;
    };
    // Only a new config rebuilds the plot — dimension and data changes are pushed into the
    // existing instance by the effects above.
  }, [config]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={plotContainer} data-testid="uplot-main-div" />
      {children}
    </div>
  );
}
