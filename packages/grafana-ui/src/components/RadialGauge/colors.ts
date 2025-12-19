import tinycolor from 'tinycolor2';

import { colorManipulator, FALLBACK_COLOR, FieldDisplay, getFieldColorMode, GrafanaTheme2 } from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';

import { GradientStop, RadialShape } from './types';
import { getFieldConfigMinMax, getFieldDisplayProcessor, getValuePercentageForValue } from './utils';

export function buildGradientColors(
  gradient = false,
  theme: GrafanaTheme2,
  fieldDisplay: FieldDisplay,
  baseColor = fieldDisplay.display.color ?? FALLBACK_COLOR
): GradientStop[] {
  if (!gradient) {
    return [
      { color: baseColor, percent: 0 },
      { color: baseColor, percent: 1 },
    ];
  }

  const colorMode = getFieldColorMode(fieldDisplay.field.color?.mode);

  // thresholds get special handling
  if (colorMode.id === FieldColorModeId.Thresholds) {
    const displayProcessor = getFieldDisplayProcessor(fieldDisplay);
    const [min, max] = getFieldConfigMinMax(fieldDisplay);
    const thresholds = fieldDisplay.field.thresholds?.steps ?? [];

    const result: Array<{ color: string; percent: number }> = [
      { color: displayProcessor(min).color ?? baseColor, percent: 0 },
    ];

    for (const threshold of thresholds) {
      if (threshold.value > min && threshold.value < max) {
        const percent = (threshold.value - min) / (max - min);
        result.push({ color: theme.visualization.getColorByName(threshold.color), percent });
      }
    }

    result.push({ color: displayProcessor(max).color ?? baseColor, percent: 1 });

    return result;
  }

  // Handle continuous color modes before other by-value modes
  if (colorMode.isContinuous && colorMode.getColors) {
    const colors = colorMode.getColors(theme);
    return colors.map((color, idx) => ({ color, percent: idx / (colors.length - 1) }));
  }

  // For value-based colors, we want to stay more true to the specific color,
  // so a radial gradient that adds a bit of light and shade works best
  if (colorMode.isByValue) {
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

  // For fixed / palette based color scales we can create a more hue and light
  // based linear gradient that we rotate with the value
  const darkerColor = tinycolor(baseColor)
    .spin(-20)
    .darken(theme.isDark ? 15 : 5);
  const lighterColor = tinycolor(baseColor).saturate(20).spin(20).brighten(10).lighten(10);

  const underlyingGradient = [
    { color: theme.isDark ? darkerColor.toString() : lighterColor.toString(), percent: 0 },
    { color: theme.isDark ? lighterColor.toString() : darkerColor.toString(), percent: 1 },
  ];

  // rotate the gradient so that the highest contrasting point is the value, depending on theme.
  const valuePercent = getValuePercentageForValue(fieldDisplay);
  const startColor = theme.isDark
    ? colorAtGradientPercent(underlyingGradient, 1 - valuePercent).toHexString()
    : underlyingGradient[0].color;
  const endColor = theme.isDark
    ? underlyingGradient[1].color
    : colorAtGradientPercent(underlyingGradient, valuePercent).toHexString();
  return [
    { color: startColor, percent: 0 },
    { color: endColor, percent: valuePercent },
    { color: endColor, percent: 1 },
  ];
}

/**
 * @alpha - perhaps this should go in colorManipulator.ts
 * Given color stops (each with a color and percentage 0..1) returns the color at a given percentage.
 * Uses tinycolor.mix for interpolation.
 * @params stops - array of color stops (percentages 0..1)
 * @params percent - percentage 0..1
 * @returns color at the given percentage
 */
export function colorAtGradientPercent(stops: GradientStop[], percent: number): tinycolor.Instance {
  if (!stops || stops.length < 2) {
    throw new Error('colorAtGradientPercent requires at least two color stops');
  }

  const sorted = stops
    .map((s: GradientStop): GradientStop => ({ color: s.color, percent: Math.min(Math.max(0, s.percent), 1) }))
    .sort((a: GradientStop, b: GradientStop) => a.percent - b.percent);

  // percent outside range
  if (percent <= sorted[0].percent) {
    return tinycolor(sorted[0].color);
  }
  if (percent >= sorted[sorted.length - 1].percent) {
    return tinycolor(sorted[sorted.length - 1].color);
  }

  // find surrounding stops using binary search
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (percent <= sorted[mid].percent) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  const left = sorted[lo];
  const right = sorted[hi];

  const range = right.percent - left.percent;
  const t = range === 0 ? 0 : (percent - left.percent) / range; // 0..1
  return tinycolor.mix(left.color, right.color, t * 100);
}

export function getBarEndcapColors(gradientStops: GradientStop[], percent = 1): [string, string] {
  if (gradientStops.length === 0) {
    throw new Error('getBarEndcapColors requires at least one color stop');
  }

  const startColor = gradientStops[0].color;
  let endColor = gradientStops[gradientStops.length - 1].color;

  // if we have a percentageFilled, use it to get a the correct end color based on where the bar terminates
  if (gradientStops.length >= 2) {
    const endColorByPercentage = colorAtGradientPercent(gradientStops, percent);
    endColor =
      endColorByPercentage.getAlpha() === 1 ? endColorByPercentage.toHexString() : endColorByPercentage.toHex8String();
  }
  return [startColor, endColor];
}

export function getGradientCss(gradientStops: GradientStop[], shape: RadialShape): string {
  const colorStrings = gradientStops.map((stop) => `${stop.color} ${(stop.percent * 100).toFixed(2)}%`);
  if (shape === 'circle') {  
    return `conic-gradient(from 0deg, ${colorStrings.join(', ')})`;
  }
  return `linear-gradient(90deg, ${colorStrings.join(', ')})`;
}

// the theme does not make the full palette available to us, and we
// don't want transparent colors which our grays usually have.
const GRAY_05 = '#111217';
const GRAY_90 = '#fbfbfb';
const CONTRAST_THRESHOLD_MAX = 4.5;
const getGuideDotColor = (color: string): string => {
  const darkColor = GRAY_05;
  const lightColor = GRAY_90;
  return colorManipulator.getContrastRatio(darkColor, color) >= CONTRAST_THRESHOLD_MAX ? darkColor : lightColor;
};

export function getEndpointMarkerColors(gradientStops: GradientStop[], percent = 1): [string, string] {
  const [startColor, endColor] = getBarEndcapColors(gradientStops, percent);
  return [getGuideDotColor(startColor), getGuideDotColor(endColor)];
}
