import React, { memo } from 'react';

import { type FieldConfig, type FieldSparkline } from '@grafana/data';
import { type GraphFieldConfig } from '@grafana/schema';

import { type Themeable2 } from '../../types/theme';
import { UPlotChart } from '../uPlot/Plot';
import { preparePlotData2, getStackingGroups } from '../uPlot/utils';

import { prepareSeries, prepareConfig } from './utils';

/**
 * Payload emitted by `Sparkline`'s `onHover` when hover support is enabled
 * (`showTooltip` or `onHover` set). `null` is emitted on mouse leave and on unmount.
 *
 * `left`/`top` are the focused point's pixel coordinates relative to the plot-area
 * origin (uPlot's `over` element), from `u.valToPos(...)`. To paint a marker outside
 * the sparkline, combine them with the chart element's bounding rect.
 */
export interface SparklineHoverEvent {
  index: number;
  value: number | null;
  xValue: number | null;
  left: number;
  top: number;
  display: string;
}

export interface SparklineProps extends Themeable2 {
  width: number;
  height: number;
  config?: FieldConfig<GraphFieldConfig>;
  sparkline: FieldSparkline;
  showHighlights?: boolean;
  /** Render a built-in tooltip on hover. Enabling this (or `onHover`) turns on the cursor. */
  showTooltip?: boolean;
  /** Fires the hovered point to the consumer; `null` on leave/unmount. Enabling this (or `showTooltip`) turns on the cursor. */
  onHover?: (hover: SparklineHoverEvent | null) => void;
}

export const Sparkline: React.FC<SparklineProps> = memo((props) => {
  const { sparkline, config: fieldConfig, theme, width, height, showHighlights, showTooltip, onHover } = props;
  const hoverEnabled = Boolean(showTooltip || onHover);

  const { frame: alignedDataFrame, warning } = prepareSeries(sparkline, theme, fieldConfig, showHighlights);
  if (warning) {
    return null;
  }

  const data = preparePlotData2(alignedDataFrame, getStackingGroups(alignedDataFrame));
  const configBuilder = prepareConfig(sparkline, alignedDataFrame, theme, showHighlights, hoverEnabled);

  return <UPlotChart data={data} config={configBuilder} width={width} height={height} />;
});

Sparkline.displayName = 'Sparkline';
