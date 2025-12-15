import tinycolor from 'tinycolor2';

import { FieldColorModeId, getFieldColorMode, GrafanaTheme2 } from '@grafana/data';

import { RadialGradientMode } from './RadialGauge';

export function buildGradientColors(
  gradientMode: RadialGradientMode,
  baseColor: string,
  theme: GrafanaTheme2,
  colorModeId?: FieldColorModeId | string,
  forSegment?: boolean
): Array<{ color: string; percent: number }> {
  if (gradientMode === 'none') {
    return [
      { color: baseColor, percent: 0 },
      { color: baseColor, percent: 1 },
    ];
  }

  const colorMode = getFieldColorMode(colorModeId);

  // TODO we need to return thresholded values here. those will have breakpoints
  // which map to exact percentages, and we should show that correctly.
  // Handle continuous color modes first
  if (colorMode.isContinuous && colorMode.getColors && !forSegment) {
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
