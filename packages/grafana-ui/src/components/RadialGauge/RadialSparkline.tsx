import { css } from '@emotion/css';

import { FieldDisplay, GrafanaTheme2, FieldConfig } from '@grafana/data';
import { GraphFieldConfig, GraphGradientMode, LineInterpolation } from '@grafana/schema';

import { Sparkline } from '../Sparkline/Sparkline';

import { RadialShape } from './RadialGauge';
import { GaugeDimensions } from './utils';

interface RadialSparklineProps {
  sparkline: FieldDisplay['sparkline'];
  dimensions: GaugeDimensions;
  theme: GrafanaTheme2;
  color?: string;
  shape?: RadialShape;
}
export function RadialSparkline({ sparkline, dimensions, theme, color, shape }: RadialSparklineProps) {
  if (!sparkline) {
    return null;
  }

  const { radius, barWidth } = dimensions;

  const height = radius / 4;
  const widthFactor = shape === 'gauge' ? 1.6 : 1.4;
  const width = radius * widthFactor - barWidth;
  const topPos = shape === 'gauge' ? `${dimensions.gaugeBottomY - height}px` : `calc(50% + ${radius / 2.8}px)`;

  const styles = css({
    position: 'absolute',
    top: topPos,
  });

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
    <div className={styles}>
      <Sparkline height={height} width={width} sparkline={sparkline} theme={theme} config={config} />
    </div>
  );
}
