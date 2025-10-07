import { FieldDisplay } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { GaugeDimensions } from './utils';
import { RadialArcPath } from './RadialArcPath';
import { getFormattedThresholds } from '../Gauge/utils';

export interface Props {
  dimensions: GaugeDimensions;
  angleRange: number;
  startAngle: number;
  endAngle: number;
  fieldDisplay: FieldDisplay;
  roundedBars?: boolean;
  glowFilter?: string;
}
export function ThresholdsBar({ dimensions, fieldDisplay, startAngle, angleRange, roundedBars, glowFilter }: Props) {
  const theme = useTheme2();
  const fieldConfig = fieldDisplay.field;
  const decimals = fieldConfig.decimals ?? 2;
  const min = fieldConfig.min ?? 0;
  const max = fieldConfig.max ?? 100;
  const thresholds = getFormattedThresholds(decimals, fieldConfig, fieldDisplay.display, theme);

  const barWidth = dimensions.barWidth / 5;
  const spaceBetweenBars = 16 - barWidth;
  const radius = dimensions.radius + barWidth + spaceBetweenBars; // 4px gap from main bar
  const thresholdDimensions = {
    ...dimensions,
    barWidth,
    radius,
  };

  let currentStart = startAngle;
  let paths: React.ReactNode[] = [];

  for (let i = 1; i < thresholds.length; i++) {
    const threshold = thresholds[i];
    const valueDeg = ((threshold.value - min) / (max - min)) * angleRange;
    const lengthDeg = valueDeg - currentStart + startAngle;

    console.log('thresholds currentStart', currentStart, valueDeg - currentStart);

    paths.push(
      <RadialArcPath
        key={i}
        startAngle={currentStart}
        arcLengthDeg={lengthDeg}
        dimensions={thresholdDimensions}
        roundedBars={roundedBars}
        glowFilter={glowFilter}
        color={threshold.color}
      />
    );

    currentStart += lengthDeg;
  }

  return <g>{paths}</g>;
}
