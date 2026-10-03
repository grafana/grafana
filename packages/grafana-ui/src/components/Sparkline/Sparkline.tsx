import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type FieldConfig, type FieldSparkline } from '@grafana/data';
import { type GraphFieldConfig } from '@grafana/schema';

import { type Themeable2 } from '../../types/theme';
import { Portal } from '../Portal/Portal';
import { VizTooltipContainer } from '../VizTooltip/VizTooltipContainer';
import { UPlotChart } from '../uPlot/Plot';
import { preparePlotData2, getStackingGroups } from '../uPlot/utils';

import { prepareSeries, prepareConfig, type SparklineHoverInfo } from './utils';

/** Hovered point emitted by `Sparkline`'s `onHover`; `null` on leave and unmount. */
export interface SparklineHoverEvent {
  index: number;
  value: number;
  /** `value` formatted via the y-field display processor. */
  display: string;
}

export interface SparklineProps extends Themeable2 {
  width: number;
  height: number;
  config?: FieldConfig<GraphFieldConfig>;
  sparkline: FieldSparkline;
  showHighlights?: boolean;
  /** Render a built-in tooltip on hover. Enabling this (or `onHover`) enables the cursor. */
  showTooltip?: boolean;
  /** Emits the hovered point; `null` on leave/unmount. Enabling this (or `showTooltip`) enables the cursor. */
  onHover?: (hover: SparklineHoverEvent | null) => void;
}

export const Sparkline: React.FC<SparklineProps> = memo((props) => {
  const { sparkline, config: fieldConfig, theme, width, height, showHighlights, showTooltip, onHover } = props;
  const hoverEnabled = Boolean(showTooltip || onHover);

  const [tooltip, setTooltip] = useState<SparklineHoverInfo | null>(null);

  // Keep the latest onHover/showTooltip reachable from the memoized uPlot hook so a changing
  // callback identity doesn't rebuild the config and re-init the plot.
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const showTooltipRef = useRef(showTooltip);
  showTooltipRef.current = showTooltip;
  // Whether a non-null hover is currently shown, so unmount/data-change can clear it.
  const hoverActiveRef = useRef(false);

  // Fan the config hook's rich record out to the trimmed public onHover and the tooltip.
  const emitHover = useCallback((hover: SparklineHoverInfo | null) => {
    hoverActiveRef.current = hover != null;
    onHoverRef.current?.(hover ? { index: hover.index, value: hover.value, display: hover.display } : null);
    // Feed the tooltip only while enabled, but always clear on leave so it can't resurface
    // stale if showTooltip toggles back on. (setTooltip(null) when already null is a no-op.)
    if (showTooltipRef.current || hover == null) {
      setTooltip(hover);
    }
  }, []);

  // Virtualized cells (e.g. tables) can unmount while hovered without a mouseleave; clear then.
  useEffect(
    () => () => {
      if (hoverActiveRef.current) {
        onHoverRef.current?.(null);
      }
    },
    []
  );

  // A data refresh can swap the series while the mouse is held still; uPlot won't re-fire the
  // cursor, so clear any active hover to avoid surfacing stale data.
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
