import { DisplayProcessor, FieldDisplay } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { RadialArcPath } from './RadialArcPath';
import { RadialGradientMode, RadialShape } from './RadialGauge';
import { GaugeDimensions } from './utils';

export interface RadialBarProps {
  angle: number;
  angleRange: number;
  dimensions: GaugeDimensions;
  displayProcessor: DisplayProcessor;
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
  displayProcessor,
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
        color={theme.colors.action.hover}
        dimensions={dimensions}
        displayProcessor={displayProcessor}
        fieldDisplay={fieldDisplay}
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
        displayProcessor={displayProcessor}
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
