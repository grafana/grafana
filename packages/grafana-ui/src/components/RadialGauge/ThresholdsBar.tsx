import { FieldDisplay } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { getFormattedThresholds } from '../Gauge/utils';

import { RadialArcPath } from './RadialArcPath';
import { RadialColorDefs } from './RadialColorDefs';
import { GaugeDimensions } from './utils';

export interface Props {
  dimensions: GaugeDimensions;
  angleRange: number;
  startAngle: number;
  endAngle: number;
  fieldDisplay: FieldDisplay;
  roundedBars?: boolean;
  glowFilter?: string;
  colorDefs: RadialColorDefs;
}
export function ThresholdsBar({
  dimensions,
  fieldDisplay,
  startAngle,
  angleRange,
  roundedBars,
  glowFilter,
  colorDefs,
}: Props) {
  const theme = useTheme2();
  const fieldConfig = fieldDisplay.field;
  const decimals = fieldConfig.decimals ?? 2;
  const min = fieldConfig.min ?? 0;
  const max = fieldConfig.max ?? 100;
  const thresholds = getFormattedThresholds(decimals, fieldConfig, theme);

  const outerRadius = dimensions.radius + dimensions.barWidth / 2;
  const thresholdDimensions = {
    ...dimensions,
    barWidth: dimensions.thresholdsBarWidth,
    radius: outerRadius + dimensions.thresholdsBarWidth / 2 + dimensions.thresholdsBarSpacing,
  };

  let currentStart = startAngle;
  let paths: React.ReactNode[] = [];

  for (let i = 1; i < thresholds.length; i++) {
    const threshold = thresholds[i];
    const valueDeg = ((threshold.value - min) / (max - min)) * angleRange;
    const lengthDeg = valueDeg - currentStart + startAngle;

    paths.push(
      <RadialArcPath
        key={i}
        startAngle={currentStart}
        arcLengthDeg={lengthDeg}
        dimensions={thresholdDimensions}
        roundedBars={roundedBars}
        glowFilter={glowFilter}
        color={colorDefs.getColor(threshold.color, true)}
      />
    );

    currentStart += lengthDeg;
  }

  return (
    <>
      <g>{paths}</g>
      <defs>{colorDefs.getDefs()}</defs>
    </>
  );
}
