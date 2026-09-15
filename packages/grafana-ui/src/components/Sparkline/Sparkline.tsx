import React, { memo, useMemo, useRef } from 'react';

import { type FieldConfig, type FieldSparkline } from '@grafana/data';
import { type GraphFieldConfig } from '@grafana/schema';

import { type Themeable2 } from '../../types/theme';
import { UPlotChart } from '../uPlot/Plot';
import { preparePlotData2, getStackingGroups } from '../uPlot/utils';

import { prepareSeries, prepareConfig } from './utils';

/**
 * Payload emitted by `Sparkline`'s `onHover` when hover support is enabled
 * (`showTooltip` or `onHover` set). `null` is emitted on mouse leave and on unmount.
 */
export interface SparklineHoverEvent {
  /** Data index of the hovered point. */
  index: number;
  /** Raw y value at the hovered point. */
  value: number | null;
  /** Formatted value (via the y-field display processor). */
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

  // Keep the latest onHover reachable from the (stable, memoized) uPlot hook so an
  // inline callback identity change never rebuilds the config / re-inits the plot.
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const emitHover = useMemo(() => (hover: SparklineHoverEvent | null) => onHoverRef.current?.(hover), []);

  const { configBuilder, data, warning } = useMemo(() => {
    const { frame, warning: seriesWarning } = prepareSeries(sparkline, theme, fieldConfig, showHighlights);
    if (seriesWarning) {
      return { warning: seriesWarning };
    }
    return {
      data: preparePlotData2(frame, getStackingGroups(frame)),
      configBuilder: prepareConfig(sparkline, frame, theme, showHighlights, hoverEnabled, emitHover),
    };
  }, [sparkline, fieldConfig, theme, showHighlights, hoverEnabled, emitHover]);

  if (warning || !configBuilder || !data) {
    return null;
  }

  return <UPlotChart data={data} config={configBuilder} width={width} height={height} />;
});

Sparkline.displayName = 'Sparkline';
