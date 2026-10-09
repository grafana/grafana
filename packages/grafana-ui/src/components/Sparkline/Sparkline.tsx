import React, { memo, useLayoutEffect, useMemo, useState } from 'react';

import { type FieldConfig, type FieldSparkline } from '@grafana/data';
import { type GraphFieldConfig } from '@grafana/schema';

import { type Themeable2 } from '../../types/theme';
import { useStableCallback } from '../../utils/useStableCallback';
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
  /** Emits the latest point at most once per animation frame; `null` immediately on leave/unmount. Enables the cursor. */
  onHover?: (hover: SparklineHoverEvent | null) => void;
}

export const Sparkline: React.FC<SparklineProps> = memo((props) => {
  return props.showTooltip || props.onHover ? <InteractiveSparkline {...props} /> : <SparklineChart {...props} />;
});

const InteractiveSparkline = (props: SparklineProps) => {
  const { showTooltip, onHover } = props;
  const [tooltip, setTooltip] = useState<SparklineHoverInfo | null>(null);
  const emitHover = useStableCallback((hover: SparklineHoverInfo | null) => {
    onHover?.(hover ? { index: hover.index, value: hover.value, display: hover.display } : null);
    if (showTooltip || hover == null) {
      setTooltip(hover);
    }
  });

  useLayoutEffect(() => {
    if (!showTooltip) {
      setTooltip(null);
    }
  }, [showTooltip]);

  return (
    <>
      <SparklineChart {...props} emitHover={emitHover} />
      {showTooltip && tooltip && (
        <Portal>
          <VizTooltipContainer position={{ x: tooltip.left, y: tooltip.top }} offset={{ x: 10, y: 10 }}>
            {tooltip.display}
          </VizTooltipContainer>
        </Portal>
      )}
    </>
  );
};

const SparklineChart = memo((props: SparklineProps & { emitHover?: (hover: SparklineHoverInfo | null) => void }) => {
  const { sparkline, config: fieldConfig, theme, width, height, showHighlights, emitHover } = props;

  const { configBuilder, data, warning } = useMemo(() => {
    const { frame, warning: seriesWarning } = prepareSeries(sparkline, theme, fieldConfig, showHighlights);
    if (seriesWarning) {
      return { warning: seriesWarning };
    }
    return {
      data: preparePlotData2(frame, getStackingGroups(frame)),
      configBuilder: prepareConfig(sparkline, frame, theme, showHighlights, Boolean(emitHover), emitHover),
    };
  }, [sparkline, fieldConfig, theme, showHighlights, emitHover]);

  if (warning || !configBuilder || !data) {
    return null;
  }

  return <UPlotChart data={data} config={configBuilder} width={width} height={height} />;
});

SparklineChart.displayName = 'SparklineChart';
Sparkline.displayName = 'Sparkline';
