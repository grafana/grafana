import { colorManipulator, DisplayProcessor, FALLBACK_COLOR, FieldDisplay, GrafanaTheme2 } from '@grafana/data';

import { RadialGradientMode, RadialShape } from './RadialGauge';
import { buildGradientColors } from './colors';
import { GaugeDimensions } from './utils';

export interface RadialColorDefsOptions {
  gradient: RadialGradientMode;
  fieldDisplay: FieldDisplay;
  theme: GrafanaTheme2;
  dimensions: GaugeDimensions;
  shape: RadialShape;
  gaugeId: string;
  displayProcessor: DisplayProcessor;
}

const CONTRAST_THRESHOLD_MAX = 4.5;
const getGuideDotColor = (color: string): string => {
  const darkColor = '#111217'; // gray05
  const lightColor = '#fbfbfb'; // gray90
  return colorManipulator.getContrastRatio(darkColor, color) >= CONTRAST_THRESHOLD_MAX ? darkColor : lightColor;
};

export class RadialColorDefs {
  constructor(private options: RadialColorDefsOptions) {}

  getSegmentColor(forValue: number): string {
    const { displayProcessor } = this.options;
    return displayProcessor(forValue).color ?? FALLBACK_COLOR;
  }

  getFieldBaseColor(): string {
    return this.options.fieldDisplay.display.color ?? FALLBACK_COLOR;
  }

  getGradient(baseColor = this.getFieldBaseColor(), forSegment?: boolean): Array<{ color: string; percent: number }> {
    const { displayProcessor, gradient, fieldDisplay, theme } = this.options;
    return buildGradientColors(gradient, baseColor, theme, displayProcessor, fieldDisplay, forSegment);
  }

  getGradientDef(): string {
    const gradientStops = this.getGradient();
    const colorStrings = gradientStops.map((stop) => `${stop.color} ${(stop.percent * 100).toFixed(2)}%`);
    return this.options.shape === 'circle'
      ? `conic-gradient(from 0deg, ${colorStrings.join(', ')})`
      : `linear-gradient(90deg, ${colorStrings.join(', ')})`;
  }

  getEndpointColors(): [string, string] {
    const { fieldDisplay } = this.options;

    const gradient = this.getGradient();
    const valuePercent = fieldDisplay.display.percent ?? 0;
    const startColor = gradient[0].color;
    let endColor = gradient[gradient.length - 1].color;

    // if we have a percentageFilled, use it to get a the correct end color based on where the bar terminates
    if (gradient.length >= 2) {
      const endColorByPercentage = colorManipulator.colorAtGradientPercent(gradient, valuePercent);
      endColor =
        endColorByPercentage.getAlpha() === 1
          ? endColorByPercentage.toHexString()
          : endColorByPercentage.toHex8String();
    }
    return [startColor, endColor];
  }

  getGuideDotColors(): [string, string] {
    const [startColor, endColor] = this.getEndpointColors();
    return [getGuideDotColor(startColor), getGuideDotColor(endColor)];
  }
}
