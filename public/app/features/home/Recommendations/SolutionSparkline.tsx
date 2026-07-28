import { useMeasure } from 'react-use';

import { type FieldConfig, type FieldSparkline } from '@grafana/data';
import { type GraphFieldConfig, GraphGradientMode, LineInterpolation } from '@grafana/schema';
import { Sparkline, Stack, Text, useTheme2 } from '@grafana/ui';

const SPARKLINE_HEIGHT = 56;

// Blue line with a soft gradient fill, matching the design. Module-level so Sparkline (memo) sees a
// stable config reference across renders.
const sparklineConfig: FieldConfig<GraphFieldConfig> = {
  color: { mode: 'fixed', fixedColor: 'blue' },
  custom: {
    lineWidth: 2,
    fillOpacity: 30,
    gradientMode: GraphGradientMode.Opacity,
    lineInterpolation: LineInterpolation.Smooth,
  },
};

export interface SolutionSparklineData {
  series: FieldSparkline;
  caption: string;
}

interface SolutionSparklineProps {
  sparkline: SolutionSparklineData;
}

/** Captioned trend chart for an enabled-solution card, e.g. cluster CPU over the last day. */
export function SolutionSparkline({ sparkline }: SolutionSparklineProps) {
  const theme = useTheme2();
  // Measure the container directly (ResizeObserver); a bare flex child gives AutoSizer width 0.
  const [measureRef, { width }] = useMeasure<HTMLDivElement>();

  return (
    <Stack direction="column">
      <div ref={measureRef} style={{ height: SPARKLINE_HEIGHT }}>
        {/* width is 0 until ResizeObserver reports; Sparkline throws in uPlot at width 0. */}
        {width > 0 && (
          <Sparkline
            width={width}
            height={SPARKLINE_HEIGHT}
            sparkline={sparkline.series}
            config={sparklineConfig}
            theme={theme}
          />
        )}
      </div>
      <Text variant="bodySmall" color="secondary" textAlignment="right">
        {sparkline.caption}
      </Text>
    </Stack>
  );
}
