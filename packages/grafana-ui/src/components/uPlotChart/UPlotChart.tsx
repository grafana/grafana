/**
 * UPlotChart wraps/extends UPlotReact with an interface that:
 *
 * 1. Accepts config: { builder: UPlotOptsBuilder, onevent: (type, callback) => void }
 *    instead of a final uPlot opts object. Typically, callback(event) => setState()
 *
 * 2. Invokes props.children(config) to allow child components to augment the config
 *    and/or subscribe to high-level events (e.g. hover, select) prior to final uPlot init.
 *
 * 3. Invokes config.builder.getOpts() to produce the final uPlot opts object, and passes it
 *    down to <UPlotReact opts={opts}>
 */

import React, { useMemo, useState } from 'react';
import { UPlotOptsBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { DEFAULT_PLOT_CONFIG } from '../uPlot/utils';
import { debugLog } from './debug';
import { UPlotReactProps, UPlotReact } from './UPlotReact';

export type Handler = (event: UPlotChartEvent) => void;

export type EventType = 'hover' | 'move';

export interface UPlotChartEvent {
  x: number;
  y: number;
  dataIdxs: (number | null)[];
  // rects?
}

//const quadtree = new Quadtree();

// set up custom pathbuilders or overrides

export interface UPlotChartConfig {
  builder: UPlotOptsBuilder;
  on(type: EventType, handler: Handler): void;
}

// Usually are React components that:
// 0. Make use of uPlot's hooks/events or augment a pre-init config
// 1. Are renderless
// 2. Or render into a portal
// 3. Or manually modify/extend uPlot's DOM
//export type UPlotChartPlugin = React.ReactComponentElement<any>;

interface UPlotChartProps extends Omit<UPlotReactProps, 'opts'> {
  config: UPlotChartConfig;
  children?: (config: UPlotChartConfig, plot?: uPlot | null) => React.ReactElement; //) => UPlotChartPlugin | UPlotChartPlugin[];
}

export const UPlotChart2 = (props: UPlotChartProps) => {
  debugLog('UPlotChart()');

  const [plot, setPlot] = useState<uPlot | null>(null);

  const oninit = (plot: uPlot | null) => {
    debugLog('oninit!', plot);
    setPlot(plot);
  };

  const { width, height, config, data, children: getChildren = () => null } = props;

  // allow all children opportunity to augment cfg
  const children = getChildren(config, plot);

  // generate final opts
  const opts = useMemo(
    () => ({
      ...DEFAULT_PLOT_CONFIG,
      ...config.builder.getConfig(),
    }),
    [config]
  );

  return (
    <>
      {children}
      <UPlotReact width={width} height={height} opts={opts} data={data} onInit={oninit} />
    </>
  );
};
