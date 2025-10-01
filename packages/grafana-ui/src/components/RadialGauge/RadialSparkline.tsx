import { css } from '@emotion/css';

import { FieldDisplay, GrafanaTheme2, FieldConfig } from '@grafana/data';
import { GraphFieldConfig, GraphGradientMode, LineInterpolation } from '@grafana/schema';

import { Sparkline } from '../Sparkline/Sparkline';

import { RadialShape } from './RadialGauge';

interface RadialSparklineProps {
  sparkline: FieldDisplay['sparkline'];
  size: number;
  theme: GrafanaTheme2;
  barWidth: number;
  margin: number;
  color?: string;
  shape?: RadialShape;
}
export function RadialSparkline({ sparkline, size, theme, barWidth, margin, color, shape }: RadialSparklineProps) {
  if (!sparkline) {
    return null;
  }

  const height = size / 8;
  const widthFactor = shape === 'gauge' ? 0.8 : 0.65;
  const width = size * widthFactor - barWidth * 1.2 - margin * 2;
  const marginFactor = shape === 'gauge' ? 0.4 : 0.5;
  const barWidthFactor = shape === 'gauge' ? 0.5 : 1.5;

  const styles = css({
    position: 'absolute',
    marginTop: size * marginFactor - barWidth * barWidthFactor + height / 3,
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
