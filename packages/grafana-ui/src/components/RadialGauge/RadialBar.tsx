import { FieldDisplay } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { RadialArcPath } from './RadialArcPath';
import { RadialGradientMode, RadialShape, RadialGaugeDimensions } from './types';

export interface RadialBarProps {
  angle: number;
  angleRange: number;
  dimensions: RadialGaugeDimensions;
  fieldDisplay: FieldDisplay;
  glowFilter?: string;
  gradientMode: RadialGradientMode;
  roundedBars?: boolean;
  shape: RadialShape;
  startAngle: number;
}
export function RadialBar({
  angle,
  angleRange,
  dimensions,
  fieldDisplay,
  glowFilter,
  gradientMode,
  roundedBars,
  shape,
  startAngle,
}: RadialBarProps) {
  const theme = useTheme2();
  return (
    <>
      {/** Track */}
      <RadialArcPath
        arcLengthDeg={angleRange - angle}
        fieldDisplay={fieldDisplay}
        color={theme.colors.action.hover}
        dimensions={dimensions}
        gradientMode="none"
        roundedBars={roundedBars}
        shape={shape}
        startAngle={startAngle + angle}
      />
      {/** The colored bar */}
      <RadialArcPath
        arcLengthDeg={angle}
        color={gradientMode === 'none' ? fieldDisplay.display.color : undefined}
        dimensions={dimensions}
        fieldDisplay={fieldDisplay}
        glowFilter={glowFilter}
        gradientMode={gradientMode}
        roundedBars={roundedBars}
        shape={shape}
        showGuideDots={roundedBars}
        startAngle={startAngle}
      />
    </>
  );
}
