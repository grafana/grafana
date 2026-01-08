import { FALLBACK_COLOR, FieldDisplay } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { RadialArcPath } from './RadialArcPath';
import { RadialShape, RadialGaugeDimensions, GradientStop } from './types';

export interface RadialBarProps {
  angle: number;
  angleRange: number;
  dimensions: RadialGaugeDimensions;
  fieldDisplay: FieldDisplay;
  gradient?: GradientStop[];
  roundedBars?: boolean;
  endpointMarker?: 'point' | 'glow';
  shape: RadialShape;
  startAngle: number;
  glowFilter?: string;
  endpointMarkerGlowFilter?: string;
}
export function RadialBar({
  angle,
  angleRange,
  dimensions,
  fieldDisplay,
  gradient,
  roundedBars,
  endpointMarker,
  shape,
  startAngle,
  glowFilter,
  endpointMarkerGlowFilter,
}: RadialBarProps) {
  const theme = useTheme2();
  const colorProps = gradient ? { gradient } : { color: fieldDisplay.display.color ?? FALLBACK_COLOR };
  return (
    <>
      {/** Track */}
      <RadialArcPath
        arcLengthDeg={angleRange - angle}
        fieldDisplay={fieldDisplay}
        color={theme.colors.action.hover}
        dimensions={dimensions}
        roundedBars={roundedBars}
        shape={shape}
        startAngle={startAngle + angle}
      />
      {/** The colored bar */}
      <RadialArcPath
        arcLengthDeg={angle}
        barEndcaps={shape === 'circle' && roundedBars}
        dimensions={dimensions}
        endpointMarker={roundedBars ? endpointMarker : undefined}
        endpointMarkerGlowFilter={endpointMarkerGlowFilter}
        fieldDisplay={fieldDisplay}
        glowFilter={glowFilter}
        roundedBars={roundedBars}
        shape={shape}
        startAngle={startAngle}
        {...colorProps}
      />
    </>
  );
}
