import { css } from '@emotion/css';
import { useMemo } from 'react';

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

  const showName = textMode === 'name' || textMode === 'value_and_name';
  const height = showName ? radius / 4 : radius / 3;
  const widthFactor = shape === 'gauge' ? 1.6 : 1.4;
  const width = radius * widthFactor - barWidth;
  const topPos = useMemo(() => {
    if (!sparkline) {
      return '';
    }
    if (shape === 'gauge') {
      return `${dimensions.gaugeBottomY - height}px`;
    }
    return `calc(50% + ${radius / 3.3}px)`;
  }, [sparkline, dimensions.gaugeBottomY, height, radius, shape]);

  if (!sparkline) {
    return null;
  }

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
