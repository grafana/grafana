import { useMeasure } from 'react-use';

import { type Field, type FieldConfig, FieldType, getMinMaxAndDelta } from '@grafana/data';
import { type GraphFieldConfig, LineInterpolation } from '@grafana/schema';
import { Sparkline, useTheme2 } from '@grafana/ui';

export type TrendColor = 'orange' | 'red' | 'green';

// Module-level so Sparkline (memo) sees a stable config reference across renders.
const CONFIGS: Record<TrendColor, FieldConfig<GraphFieldConfig>> = {
  orange: makeConfig('orange'),
  red: makeConfig('red'),
  green: makeConfig('green'),
};

interface Props {
  values: number[];
  color?: TrendColor;
  height?: number;
  // Fixes the scale from 0 to max so several sparklines compare; otherwise each one fills its own height.
  max?: number;
}

export function TrendSparkline({ values, color = 'orange', height = 32, max }: Props) {
  const theme = useTheme2();
  // A bare flex child gives Sparkline width 0, and uPlot throws at width 0.
  const [measureRef, { width }] = useMeasure<HTMLDivElement>();

  return (
    <div ref={measureRef} style={{ height }}>
      {width > 0 && (
        <Sparkline
          width={width}
          height={height}
          sparkline={toSparkline(values, max)}
          config={CONFIGS[color]}
          theme={theme}
        />
      )}
    </div>
  );
}

function makeConfig(color: TrendColor): FieldConfig<GraphFieldConfig> {
  return {
    color: { mode: 'fixed', fixedColor: color },
    custom: { lineWidth: 1, fillOpacity: 0, lineInterpolation: LineInterpolation.Linear },
  };
}

function toSparkline(values: number[], max?: number) {
  const y: Field = { name: 'value', type: FieldType.number, values, config: {} };
  const range = max === undefined ? getMinMaxAndDelta(y) : { min: 0, max, delta: max };
  return { y: { ...y, state: { range } } };
}
