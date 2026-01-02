export type RadialTextMode = 'auto' | 'value_and_name' | 'value' | 'name' | 'none';
export type RadialShape = 'circle' | 'gauge';

export interface RadialGaugeDimensions {
  margin: number;
  radius: number;
  centerX: number;
  centerY: number;
  barWidth: number;
  endAngle?: number;
  barIndex: number;
  thresholdsBarRadius: number;
  thresholdsBarWidth: number;
  thresholdsBarSpacing: number;
  scaleLabelsFontSize: number;
  scaleLabelsSpacing: number;
  scaleLabelsRadius: number;
  gaugeBottomY: number;
}

/** @alpha - perhaps this should go in @grafana/data */
export interface GradientStop {
  color: string;
  percent: number;
}
