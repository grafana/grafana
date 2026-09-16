import React, { memo, useEffect, useMemo, useRef, useState } from 'react';

import { type FieldConfig, type FieldSparkline } from '@grafana/data';
import { type GraphFieldConfig } from '@grafana/schema';

import { type Themeable2 } from '../../types/theme';
import { Portal } from '../Portal/Portal';
import { VizTooltipContainer } from '../VizTooltip/VizTooltipContainer';
import { UPlotChart } from '../uPlot/Plot';
import { preparePlotData2, getStackingGroups } from '../uPlot/utils';

import { prepareSeries, prepareConfig, type SparklineHoverInfo } from './utils';

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

  const [tooltip, setTooltip] = useState<SparklineHoverInfo | null>(null);

  // Keep the latest onHover / showTooltip reachable from the (stable, memoized) uPlot
  // hook so an inline callback identity change never rebuilds the config / re-inits the plot.
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const showTooltipRef = useRef(showTooltip);
  showTooltipRef.current = showTooltip;
  // Tracks whether the consumer currently sees a non-null hover, so unmount can clear it.
  const hoverActiveRef = useRef(false);

  // Single source of truth: the config hook emits a rich hover record; we fan it out to
  // the public (trimmed) onHover and to the built-in tooltip state.
  const emitHover = useMemo(
    () => (hover: SparklineHoverInfo | null) => {
      hoverActiveRef.current = hover != null;
      onHoverRef.current?.(hover ? { index: hover.index, value: hover.value, display: hover.display } : null);
      if (showTooltipRef.current) {
        setTooltip(hover);
      }
    },
    []
  );

  // Virtualized cells (e.g. tables) can unmount while hovered without a mouseleave, so
  // clear the consumer's hover state on unmount if it is still active.
  useEffect(
    () => () => {
      if (hoverActiveRef.current) {
        onHoverRef.current?.(null);
      }
    },
    []
  );

  // The underlying series can change while the mouse is held still over the sparkline
  // (e.g. a data refresh). uPlot won't re-fire the cursor, so clear any active hover to
  // avoid showing a value tied to the previous data until the next mouse move.
  useEffect(() => {
    if (hoverActiveRef.current) {
      emitHover(null);
    }
  }, [sparkline, emitHover]);

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

  return (
    <>
      <UPlotChart data={data} config={configBuilder} width={width} height={height} />
      {showTooltip && tooltip && (
        <Portal>
          <VizTooltipContainer position={{ x: tooltip.left, y: tooltip.top }} offset={{ x: 10, y: 10 }}>
            {tooltip.display}
          </VizTooltipContainer>
        </Portal>
      )}
    </>
  );
});

Sparkline.displayName = 'Sparkline';
