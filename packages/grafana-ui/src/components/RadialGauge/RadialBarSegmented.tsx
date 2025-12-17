import { memo } from 'react';

import { FALLBACK_COLOR, FieldDisplay } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { RadialArcPath } from './RadialArcPath';
import { RadialShape, RadialGaugeDimensions } from './types';
import {
  getAngleBetweenSegments,
  getFieldConfigMinMax,
  getFieldDisplayProcessor,
  getOptimalSegmentCount,
} from './utils';

export interface RadialBarSegmentedProps {
  fieldDisplay: FieldDisplay;
  dimensions: RadialGaugeDimensions;
  angleRange: number;
  startAngle: number;
  glowFilter?: string;
  segmentCount: number;
  segmentSpacing: number;
  shape: RadialShape;
  gradient?: boolean;
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
  }: RadialBarSegmentedProps) => {
    const theme = useTheme2();

    const segments: React.ReactNode[] = [];
    const segmentCountAdjusted = getOptimalSegmentCount(dimensions, segmentSpacing, segmentCount, angleRange);
    const [min, max] = getFieldConfigMinMax(fieldDisplay);
    const value = fieldDisplay.display.numeric;
    const angleBetweenSegments = getAngleBetweenSegments(segmentSpacing, segmentCount, angleRange);
    const segmentArcLengthDeg = angleRange / segmentCountAdjusted - angleBetweenSegments;
    const displayProcessor = getFieldDisplayProcessor(fieldDisplay);

    for (let i = 0; i < segmentCountAdjusted; i++) {
      const angleValue = min + ((max - min) / segmentCountAdjusted) * i;
      const segmentAngle = startAngle + (angleRange / segmentCountAdjusted) * i + 0.01;
      let segmentColor: string | undefined;
      if (angleValue >= value) {
        segmentColor = theme.colors.action.hover;
      } else if (!gradient) {
        segmentColor = displayProcessor(angleValue).color ?? FALLBACK_COLOR;
      }

      segments.push(
        <RadialArcPath
          key={i}
          arcLengthDeg={segmentArcLengthDeg}
          color={segmentColor}
          dimensions={dimensions}
          fieldDisplay={fieldDisplay}
          glowFilter={glowFilter}
          gradient={gradient}
          shape={shape}
          startAngle={segmentAngle}
        />
      );
    }

    return <g>{segments}</g>;
  }
);

RadialBarSegmented.displayName = 'RadialBarSegmented';
