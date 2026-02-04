import { memo } from 'react';

import { FALLBACK_COLOR, FieldDisplay } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { RadialArcPath } from './RadialArcPath';
import { RadialShape, RadialGaugeDimensions, GradientStop } from './types';
import {
  getAngleBetweenSegments,
  getFieldConfigMinMax,
  getFieldDisplayProcessor,
  getOptimalSegmentCount,
  getValuePercentageForValue,
} from './utils';

export interface RadialBarSegmentedProps {
  fieldDisplay: FieldDisplay;
  dimensions: RadialGaugeDimensions;
  angleRange: number;
  startAngle: number;
  startValueAngle: number;
  endValueAngle: number;
  glowFilter?: string;
  segmentCount: number;
  segmentSpacing: number;
  shape: RadialShape;
  gradient?: GradientStop[];
}

export const RadialBarSegmented = memo(
  ({
    fieldDisplay,
    dimensions,
    startAngle,
    angleRange,
    glowFilter,
    gradient,
    segmentCount,
    segmentSpacing,
    shape,
    startValueAngle,
    endValueAngle,
  }: RadialBarSegmentedProps) => {
    const theme = useTheme2();
    const segments: React.ReactNode[] = [];
    const segmentCountAdjusted = getOptimalSegmentCount(dimensions, segmentSpacing, segmentCount, angleRange);
    const [min, max] = getFieldConfigMinMax(fieldDisplay);
    const angleBetweenSegments = getAngleBetweenSegments(segmentSpacing, segmentCount, angleRange);
    const segmentArcLengthDeg = angleRange / segmentCountAdjusted - angleBetweenSegments;
    const displayProcessor = getFieldDisplayProcessor(fieldDisplay);

    for (let i = 0; i < segmentCountAdjusted; i++) {
      const value = min + ((max - min) / segmentCountAdjusted) * i;
      const segmentAngle = getValuePercentageForValue(fieldDisplay, value) * angleRange;
      const isTrack = segmentAngle < startValueAngle || segmentAngle >= startValueAngle + endValueAngle;
      const segmentStartAngle = startAngle + (angleRange / segmentCountAdjusted) * i + 0.01;
      const segmentColor = isTrack ? theme.colors.border.medium : (displayProcessor(value).color ?? FALLBACK_COLOR);
      const colorProps = !isTrack && gradient ? { gradient } : { color: segmentColor };

      segments.push(
        <RadialArcPath
          key={i}
          arcLengthDeg={segmentArcLengthDeg}
          dimensions={dimensions}
          fieldDisplay={fieldDisplay}
          glowFilter={glowFilter}
          shape={shape}
          startAngle={segmentStartAngle}
          {...colorProps}
        />
      );
    }

    return <g>{segments}</g>;
  }
);

RadialBarSegmented.displayName = 'RadialBarSegmented';
