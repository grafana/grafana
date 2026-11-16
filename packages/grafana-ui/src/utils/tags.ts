import tinycolor from 'tinycolor2';

import { type GrafanaTheme2 } from '@grafana/data';
import { DEFAULT_TAG_COLORS } from '@grafana/data/unstable';

export function getTagColorIndexFromName(name = '', theme?: GrafanaTheme2): number {
  const colors = theme?.components.tag.colors ?? DEFAULT_TAG_COLORS;
  const hash = djb2(name.toLowerCase());
  return Math.abs(hash % colors.length);
}

/**
 * Returns the background and text colors for a tag badge based on its name.
 * The colors come from the active theme (`theme.components.tag.colors`); each theme provides the shades
 * appropriate for its own mode, so callers can use them directly without swapping.
 * @param name tag name
 */
export function getTagColorsFromName(name = '', theme?: GrafanaTheme2) {
  const index = getTagColorIndexFromName(name, theme);
  return getTagColor(index, theme);
}

/**
 * Returns the background and text colors for a tag badge from the palette in the active theme
 * (`theme.components.tag.colors`).
 * A CSS color instead of an index produces a tonal pair in the same hue.
 * @param index index into the palette. Wrapped with modulo, so any number is valid — indexes
 * beyond the end of the palette cycle back around to the start.
 */
export function getTagColor(index: number | string, theme?: GrafanaTheme2) {
  const colors = theme?.components.tag.colors ?? DEFAULT_TAG_COLORS;
  const { background, text } =
    typeof index === 'string' ? getTonalTagColors(index, theme) : colors[Math.abs(index % colors.length)];

  const result = { background, text };

  // this maintains backwards runtime compatibility for a little bit
  // TODO remove in Grafana 14
  Object.assign(result, { color: background, borderColor: text });

  return result;
}

function getTonalTagColors(color: string, theme?: GrafanaTheme2) {
  const base = tinycolor(color);
  if (base.getAlpha() === 0) {
    return { background: 'rgba(0,0,0,0)', text: theme?.colors.text.primary ?? 'rgb(247, 248, 250)' };
  }

  base.setAlpha(1);
  const isDark = theme?.isDark ?? true;
  const source = rgbToOklch(base.toRgb());
  let lowerDelta = 0;
  let upperDelta = 4;

  // Split required tonal distance 1:3 between background and text. This minimizes a squared
  // perceptual-distance cost that weights background fidelity three times more heavily.
  for (let index = 0; index < 12; index++) {
    const delta = (lowerDelta + upperDelta) / 2;
    const pair = getOklchPair(source, delta, isDark);
    if (tinycolor.readability(pair.background, pair.text) >= 4.5) {
      upperDelta = delta;
    } else {
      lowerDelta = delta;
    }
  }

  const pair = getOklchPair(source, upperDelta, isDark);
  return {
    background: tinycolor(pair.background).toRgbString(),
    text: tinycolor(pair.text).toRgbString(),
  };
}

interface OklchColor {
  l: number;
  c: number;
  h: number;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function getOklchPair(source: OklchColor, delta: number, isDark: boolean) {
  const direction = isDark ? -1 : 1;
  return {
    background: oklchToRgb({ ...source, l: clamp(source.l + direction * delta * 0.25) }),
    text: oklchToRgb({ ...source, l: clamp(source.l - direction * delta * 0.75) }),
  };
}

function rgbToOklch(rgb: tinycolor.ColorFormats.RGBA): OklchColor {
  const r = srgbToLinear(rgb.r / 255);
  const g = srgbToLinear(rgb.g / 255);
  const b = srgbToLinear(rgb.b / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const labL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const labA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const labB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  return { l: labL, c: Math.hypot(labA, labB), h: Math.atan2(labB, labA) };
}

function oklchToRgb(color: OklchColor): RgbColor {
  let lowerChroma = 0;
  let upperChroma = color.c;
  let rgb = oklchToUnclampedRgb(color);

  // Keep hue and lightness stable; reduce chroma only when requested color falls outside sRGB.
  if (!isInGamut(rgb)) {
    for (let index = 0; index < 8; index++) {
      const chroma = (lowerChroma + upperChroma) / 2;
      const candidate = oklchToUnclampedRgb({ ...color, c: chroma });
      if (isInGamut(candidate)) {
        lowerChroma = chroma;
        rgb = candidate;
      } else {
        upperChroma = chroma;
      }
    }
  }

  return {
    r: clamp(rgb.r) * 255,
    g: clamp(rgb.g) * 255,
    b: clamp(rgb.b) * 255,
  };
}

function oklchToUnclampedRgb({ l, c, h }: OklchColor): RgbColor {
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;
  const linearR = 4.0767416621 * lPrime ** 3 - 3.3077115913 * mPrime ** 3 + 0.2309699292 * sPrime ** 3;
  const linearG = -1.2684380046 * lPrime ** 3 + 2.6097574011 * mPrime ** 3 - 0.3413193965 * sPrime ** 3;
  const linearB = -0.0041960863 * lPrime ** 3 - 0.7034186147 * mPrime ** 3 + 1.707614701 * sPrime ** 3;

  return { r: linearToSrgb(linearR), g: linearToSrgb(linearG), b: linearToSrgb(linearB) };
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number) {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
}

function isInGamut({ r, g, b }: RgbColor) {
  return r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1;
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function djb2(str: string) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash;
}
