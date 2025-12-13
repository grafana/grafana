import tinycolor from 'tinycolor2';

import {
  colorManipulator,
  DisplayProcessor,
  FALLBACK_COLOR,
  FieldDisplay,
  getFieldColorMode,
  GrafanaTheme2,
} from '@grafana/data';

import { RadialGradientMode, RadialShape } from './RadialGauge';
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

const CONTRAST_THRESHOLD_MAX = 7.5;
const getGuideDotColor = (color: string): string => {
  const darkColor = '#111217'; // gray05
  const lightColor = '#fbfbfb'; // gray90
  return colorManipulator.getContrastRatio(darkColor, color) >= CONTRAST_THRESHOLD_MAX ? darkColor : lightColor;
};

export class RadialColorDefs {
  private colorToIds: Record<string, string> = {};
  private defs: React.ReactNode[] = [];

  constructor(private options: RadialColorDefsOptions) {}

  getSegmentColor(forValue: number): string {
    const { displayProcessor } = this.options;
    const baseColor = displayProcessor(forValue).color ?? FALLBACK_COLOR;

    return this.getColor(baseColor, true);
  }

  getColor(baseColor: string, forSegment?: boolean): string {
    const { gradient, dimensions, gaugeId, fieldDisplay, shape, theme } = this.options;

    const id = `value-color-${baseColor}-${gaugeId}`;

    if (this.colorToIds[id]) {
      return this.colorToIds[id];
    }

    // If no gradient, just return the base color
    if (gradient === 'none') {
      this.colorToIds[id] = baseColor;
      return baseColor;
    }

    const returnColor = (this.colorToIds[id] = `url(#${id})`);
    const colorModeId = fieldDisplay.field.color?.mode;
    const colorMode = getFieldColorMode(colorModeId);
    const valuePercent = fieldDisplay.display.percent ?? 0;

    const gradientStops = this.getGradient();
    const stops = gradientStops.map((stop, i) => (
      <stop key={i} offset={`${(stop.percent * 100).toFixed(2)}%`} stopColor={stop.color} stopOpacity={1} />
    ));

    // Handle continusous color modes first
    // If it's a segment color we don't want to do continuous gradients
    if (colorMode.isContinuous && colorMode.getColors && !forSegment) {
      this.defs.push(
        <linearGradient key={id} id={id} x1="0" y1="0" x2={1 / valuePercent} y2="0">
          {stops}
        </linearGradient>
      );

      return returnColor;
    }

    // For value based colors we want to stay more true to the specific color
    // So a radial gradient that adds a bit of light and shade works best
    if (colorMode.isByValue) {
      this.defs.push(
        <radialGradient key={id} id={id} x1="0" y1="0" x2={1 / valuePercent} y2="0">
          {stops}
        </radialGradient>
      );

      return returnColor;
    }

    // For fixed / palette based color scales we can create a more fun
    // hue and light based linear gradient that we rotate/move with the value
    const x2 = shape === 'circle' ? 0 : dimensions.centerX + dimensions.radius;
    const y2 = shape === 'circle' ? dimensions.centerY + dimensions.radius : 0;

    // this makes it so the gradient is always brightest at the current value
    // this makes the point color math much more annoying so it's currently disabled.
    const transform =
      shape === 'circle'
        ? `rotate(${360 * valuePercent - 180} ${dimensions.centerX} ${dimensions.centerY})`
        : `translate(-${dimensions.radius * 2 * (1 - valuePercent)}, 0)`;

    this.defs.push(
      <linearGradient
        key={id}
        id={id}
        x1="0"
        y1="0"
        x2={x2}
        y2={y2}
        gradientUnits="userSpaceOnUse"
        gradientTransform={transform}
      >
        {stops}
      </linearGradient>
    );

    return returnColor;
  }

  getFieldBaseColor(): string {
    return this.options.fieldDisplay.display.color ?? FALLBACK_COLOR;
  }

  getMainBarColor(): string {
    return this.getColor(this.getFieldBaseColor());
  }

  getGradient(): Array<{ color: string; percent: number }> {
    const { gradient, fieldDisplay, theme } = this.options;
    const baseColor = this.getFieldBaseColor();
    if (gradient === 'none') {
      return [
        { color: baseColor, percent: 0 },
        { color: baseColor, percent: 1 },
      ];
    }

    const colorModeId = fieldDisplay.field.color?.mode;
    const colorMode = getFieldColorMode(colorModeId);

    // Handle continusous color modes first
    if (colorMode.isContinuous && colorMode.getColors) {
      const colors = colorMode.getColors(theme);
      return colors.map((color, idx) => ({ color, percent: idx / (colors.length - 1) }));
    } else if (colorMode.isByValue) {
      // For value based colors we want to stay more true to the specific color
      // So a radial gradient that adds a bit of light and shade works best
      const darkerColor = tinycolor(baseColor).darken(5);
      const lighterColor = tinycolor(baseColor).spin(20).lighten(10);

      const color1 = theme.isDark ? lighterColor : darkerColor;
      const color2 = theme.isDark ? darkerColor : lighterColor;

      return [
        { color: color1.toString(), percent: 0 },
        { color: color2.toString(), percent: 0.6 },
        { color: color2.toString(), percent: 1 },
      ];
    }

    // For value based colors we want to stay more true to the specific color
    // So a radial gradient that adds a bit of light and shade works best
    // we set the highest contrast color second based on the theme.
    const darkerColor = tinycolor(baseColor).spin(-20).darken(5);
    const lighterColor = tinycolor(baseColor).saturate(20).spin(20).brighten(10);
    return theme.isDark
      ? [
          { color: darkerColor.darken(10).toString(), percent: 0 },
          { color: lighterColor.lighten(10).toString(), percent: 1 },
        ]
      : [
          { color: lighterColor.lighten(10).toString(), percent: 0 },
          { color: darkerColor.toString(), percent: 1 },
        ];
  }

  getGuideDotColors(): [string, string] {
    const { fieldDisplay } = this.options;

    const gradient = this.getGradient();
    let valuePercent = fieldDisplay.display.percent ?? 0;

    let startColor = gradient[0].color;
    let endColor = gradient[gradient.length - 1].color;

    const colorMode = getFieldColorMode(fieldDisplay.field.color?.mode);
    if (colorMode.isContinuous) {
    } else if (colorMode.isByValue) {
    } else {
    }

    // if we have a percentageFilled, use it to get a the correct end color based on where the bar terminates
    if (gradient.length >= 2) {
      const endColorByPercentage = colorManipulator.colorAtGradientPercent(gradient, valuePercent);
      endColor =
        endColorByPercentage.getAlpha() === 1
          ? endColorByPercentage.toHexString()
          : endColorByPercentage.toHex8String();
    }

    return [getGuideDotColor(startColor), getGuideDotColor(endColor)];
  }

  getDefs(): React.ReactNode[] {
    return this.defs;
  }
}
