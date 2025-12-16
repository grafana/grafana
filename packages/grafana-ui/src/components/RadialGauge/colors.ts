import tinycolor from 'tinycolor2';

import {
  colorManipulator,
  DisplayProcessor,
  FALLBACK_COLOR,
  FieldDisplay,
  getFieldColorMode,
  GradientStop,
  GrafanaTheme2,
} from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';

import { RadialGradientMode, RadialShape } from './RadialGauge';

export function buildGradientColors(
  gradientMode: RadialGradientMode,
  theme: GrafanaTheme2,
  displayProcessor: DisplayProcessor,
  fieldDisplay: FieldDisplay,
  baseColor = FALLBACK_COLOR,
  forSegment?: boolean
): GradientStop[] {
  if (gradientMode === 'none') {
    return [
      { color: baseColor, percent: 0 },
      { color: baseColor, percent: 1 },
    ];
  }

  const colorMode = getFieldColorMode(fieldDisplay.field.color?.mode);

  if (colorMode.id === FieldColorModeId.Thresholds) {
    const thresholds = fieldDisplay.field.thresholds?.steps ?? [];
    const min = fieldDisplay.field.min ?? 0;
    const max = fieldDisplay.field.max ?? 100;

    const result: Array<{ color: string; percent: number }> = [
      { color: displayProcessor(min).color ?? baseColor, percent: 0 },
    ];

    for (const threshold of thresholds) {
      if (threshold.value > min && threshold.value < max) {
        const percent = (threshold.value - min) / (max - min);
        result.push({ color: threshold.color, percent });
      }
    }

    result.push({ color: displayProcessor(max).color ?? baseColor, percent: 1 });

    return result;
  }

  if (colorMode.isContinuous && colorMode.getColors && !forSegment) {
    // Handle continuous color modes first
    const colors = colorMode.getColors(theme);
    return colors.map((color, idx) => ({ color, percent: idx / (colors.length - 1) }));
  }

  if (colorMode.isByValue) {
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

export function getEndpointColors(gradientStops: GradientStop[], percent = 0): [string, string] {
  const startColor = gradientStops[0].color;
  let endColor = gradientStops[gradientStops.length - 1].color;

  // if we have a percentageFilled, use it to get a the correct end color based on where the bar terminates
  if (gradientStops.length >= 2) {
    const endColorByPercentage = colorManipulator.colorAtGradientPercent(gradientStops, percent);
    endColor =
      endColorByPercentage.getAlpha() === 1 ? endColorByPercentage.toHexString() : endColorByPercentage.toHex8String();
  }
  return [startColor, endColor];
}

export function getGradientCss(gradientStops: GradientStop[], shape: RadialShape): string {
  const colorStrings = gradientStops.map((stop) => `${stop.color} ${(stop.percent * 100).toFixed(2)}%`);
  return shape === 'circle'
    ? `conic-gradient(from 0deg, ${colorStrings.join(', ')})`
    : `linear-gradient(90deg, ${colorStrings.join(', ')})`;
}

const CONTRAST_THRESHOLD_MAX = 4.5;
const getGuideDotColor = (color: string): string => {
  const darkColor = '#111217'; // gray05
  const lightColor = '#fbfbfb'; // gray90
  return colorManipulator.getContrastRatio(darkColor, color) >= CONTRAST_THRESHOLD_MAX ? darkColor : lightColor;
};

export function getGuideDotColors(gradientStops: GradientStop[], percent = 0): [string, string] {
  const [startColor, endColor] = getEndpointColors(gradientStops, percent);
  return [getGuideDotColor(startColor), getGuideDotColor(endColor)];
}
