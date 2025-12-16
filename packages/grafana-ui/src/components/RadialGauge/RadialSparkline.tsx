import { FieldDisplay, GrafanaTheme2, FieldConfig } from '@grafana/data';
import { GraphFieldConfig, GraphGradientMode, LineInterpolation } from '@grafana/schema';

import { Sparkline } from '../Sparkline/Sparkline';

import { RadialShape, RadialTextMode } from './RadialGauge';
import { GaugeDimensions } from './utils';

interface RadialSparklineProps {
  sparkline: FieldDisplay['sparkline'];
  dimensions: GaugeDimensions;
  theme: GrafanaTheme2;
  color?: string;
  shape?: RadialShape;
  textMode: Exclude<RadialTextMode, 'auto'>;
}
export function RadialSparkline({ sparkline, dimensions, theme, color, shape, textMode }: RadialSparklineProps) {
  const { radius, barWidth } = dimensions;

  if (!sparkline) {
    return null;
  }

  const showNameAndValue = textMode === 'value_and_name';
  const height = radius / (showNameAndValue ? 4 : 3);
  const width = radius * (shape === 'gauge' ? 1.6 : 1.4) - barWidth;
  const topPos =
    shape === 'gauge'
      ? `${dimensions.gaugeBottomY - height}px`
      : `calc(50% + ${radius / (showNameAndValue ? 3.3 : 4)}px)`;

  const config: FieldConfig<GraphFieldConfig> = {
    color: {
      mode: 'fixed',
      fixedColor: color ?? 'blue',
    },
    custom: {
      gradientMode: GraphGradientMode.Opacity,
      fillOpacity: 40,
      lineInterpolation: LineInterpolation.Smooth,
    },
  };

  return (
    <div style={{ position: 'absolute', top: topPos }}>
      <Sparkline height={height} width={width} sparkline={sparkline} theme={theme} config={config} />
    </div>
  );
}
