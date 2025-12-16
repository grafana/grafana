import { memo, useMemo } from 'react';

import { FieldDisplay, GrafanaTheme2, FieldConfig } from '@grafana/data';
import { GraphFieldConfig, GraphGradientMode, LineInterpolation } from '@grafana/schema';

import { Sparkline } from '../Sparkline/Sparkline';

import { RadialShape, RadialTextMode, RadialGaugeDimensions } from './types';

interface RadialSparklineProps {
  sparkline: FieldDisplay['sparkline'];
  dimensions: RadialGaugeDimensions;
  theme: GrafanaTheme2;
  color?: string;
  shape?: RadialShape;
  textMode: Exclude<RadialTextMode, 'auto'>;
}

const SPARKLINE_HEIGHT_DIVISOR = 4;
const SPARKLINE_HEIGHT_DIVISOR_NAME_AND_VALUE = 4;
const SPARKLINE_WIDTH_FACTOR_ARC = 1.4;
const SPARKLINE_WIDTH_FACTOR_CIRCLE = 1.6;
const SPARKLINE_TOP_OFFSET_DIVISOR_CIRCLE = 4;
const SPARKLINE_TOP_OFFSET_DIVISOR_CIRCLE_NAME_AND_VALUE = 3.3;
const SPARKLINE_SPACING = 8;

export const RadialSparkline = memo(
  ({ sparkline, dimensions, theme, color, shape, textMode }: RadialSparklineProps) => {
    const { radius, barWidth } = dimensions;

    const showNameAndValue = textMode === 'value_and_name';
    const height = radius / (showNameAndValue ? SPARKLINE_HEIGHT_DIVISOR_NAME_AND_VALUE : SPARKLINE_HEIGHT_DIVISOR);
    const width = radius * (shape === 'gauge' ? SPARKLINE_WIDTH_FACTOR_ARC : SPARKLINE_WIDTH_FACTOR_CIRCLE) - barWidth;
    const topPos =
      shape === 'gauge'
        ? dimensions.gaugeBottomY - height - SPARKLINE_SPACING
        : `calc(50% + ${radius / (showNameAndValue ? SPARKLINE_TOP_OFFSET_DIVISOR_CIRCLE_NAME_AND_VALUE : SPARKLINE_TOP_OFFSET_DIVISOR_CIRCLE)}px)`;

    const config: FieldConfig<GraphFieldConfig> = useMemo(
      () => ({
        color: {
          mode: 'fixed',
          fixedColor: color ?? 'blue',
        },
        custom: {
          gradientMode: GraphGradientMode.Opacity,
          fillOpacity: 40,
          lineInterpolation: LineInterpolation.Smooth,
        },
      }),
      [color]
    );

    if (!sparkline) {
      return null;
    }

    return (
      <div style={{ position: 'absolute', top: topPos }}>
        <Sparkline height={height} width={width} sparkline={sparkline} theme={theme} config={config} />
      </div>
    );
  }
);

RadialSparkline.displayName = 'RadialSparkline';
