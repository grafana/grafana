import { useMemo } from 'react';

import { colorManipulator, FALLBACK_COLOR, FieldDisplay } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { RadialArcPath } from './RadialArcPath';
import { RadialShape, RadialGaugeDimensions, GradientStop } from './types';

export interface RadialBarProps {
  angleRange: number;
  dimensions: RadialGaugeDimensions;
  fieldDisplay: FieldDisplay;
  gradient?: GradientStop[];
  roundedBars?: boolean;
  endpointMarker?: 'point' | 'glow';
  shape: RadialShape;
  startAngle: number;
  startValueAngle: number;
  endValueAngle: number;
  glowFilter?: string;
  endpointMarkerGlowFilter?: string;
}
export function RadialBar({
  angleRange,
  dimensions,
  fieldDisplay,
  gradient,
  roundedBars,
  endpointMarker,
  shape,
  startAngle,
  startValueAngle,
  endValueAngle,
  glowFilter,
  endpointMarkerGlowFilter,
}: RadialBarProps) {
  const theme = useTheme2();
  const colorProps = gradient ? { gradient } : { color: fieldDisplay.display.color ?? FALLBACK_COLOR };
  const trackColor = useMemo(
    () => colorManipulator.onBackground(theme.colors.action.hover, theme.colors.background.primary).toHexString(),
    [theme]
  );

  return (
    <>
      {/** Track before value */}
      {startValueAngle !== 0 && (
        <RadialArcPath
          arcLengthDeg={startValueAngle}
          fieldDisplay={fieldDisplay}
          color={trackColor}
          dimensions={dimensions}
          roundedBars={roundedBars}
          shape={shape}
          startAngle={startAngle}
        />
      )}
      {/** Track after value */}
      <RadialArcPath
        arcLengthDeg={angleRange - endValueAngle - startValueAngle}
        fieldDisplay={fieldDisplay}
        color={trackColor}
        dimensions={dimensions}
        roundedBars={roundedBars}
        shape={shape}
        startAngle={startAngle + startValueAngle + endValueAngle}
      />
      {/** The colored bar */}
      <RadialArcPath
        arcLengthDeg={endValueAngle}
        barEndcaps={shape === 'circle' && roundedBars}
        dimensions={dimensions}
        endpointMarker={roundedBars ? endpointMarker : undefined}
        endpointMarkerGlowFilter={endpointMarkerGlowFilter}
        fieldDisplay={fieldDisplay}
        glowFilter={glowFilter}
        roundedBars={roundedBars}
        shape={shape}
        startAngle={startAngle + startValueAngle}
        {...colorProps}
      />
    </>
  );
}
