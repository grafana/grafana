// Code based on Material-UI
// https://github.com/mui-org/material-ui/blob/1b096070faf102281f8e3c4f9b2bf50acf91f412/packages/material-ui/src/styles/colorManipulator.js#L97
// MIT License Copyright (c) 2014 Call-Em-All

import tinycolor from 'tinycolor2';

/**
 * Returns a number whose value is limited to the given range.
 * @param value The value to be clamped
 * @param min The lower boundary of the output range
 * @param max The upper boundary of the output range
 * @returns A number in the range [min, max]
 * @beta
 */
function clamp(value: number, min = 0, max = 1) {
  if (process.env.NODE_ENV !== 'production') {
    if (value < min || value > max) {
      console.error(`The value provided ${value} is out of range [${min}, ${max}].`);
    }
  }

  return Math.min(Math.max(min, value), max);
}

/**
 * Converts a color from CSS hex format to CSS rgb format.
 * @param color - Hex color, i.e. #nnn or #nnnnnn
 * @returns A CSS rgb color string
 * @beta
 */
export function hexToRgb(color: string) {
  color = color.slice(1);

  const re = new RegExp(`.{1,${color.length >= 6 ? 2 : 1}}`, 'g');
  let result = color.match(re);

  if (!result) {
    return '';
  }

  let colors = Array.from(result);

  if (colors[0].length === 1) {
    colors = colors.map((n) => n + n);
  }

  return colors
    ? `rgb${colors.length === 4 ? 'a' : ''}(${colors
        .map((n, index) => {
          return index < 3 ? parseInt(n, 16) : Math.round((parseInt(n, 16) / 255) * 1000) / 1000;
        })
        .join(', ')})`
    : '';
}

function intToHex(int: number) {
  const hex = int.toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
}

/**
 * Converts a color from CSS rgb format to CSS hex format.
 * @param color - RGB color, i.e. rgb(n, n, n)
 * @returns A CSS rgb color string, i.e. #nnnnnn
 * @beta
 */
export function rgbToHex(color: string) {
  // Idempotent
  if (color.indexOf('#') === 0) {
    return color;
  }

  const { values } = decomposeColor(color);
  return `#${values.map((n: number) => intToHex(n)).join('')}`;
}

/**
 * Converts a color to hex6 format if there is no alpha, hex8 if there is.
 * @param color - Hex, RGB, HSL color
 * @returns A hex color string, i.e. #ff0000 or #ff0000ff
 */
export function asHexString(color: string): string {
  if (color[0] === '#') {
    return color;
  }
  const tColor = tinycolor(color);
  return tColor.getAlpha() === 1 ? tColor.toHexString() : tColor.toHex8String();
}

/**
 * Converts a color to rgb string
 */
export function asRgbString(color: string) {
  if (color.startsWith('rgb')) {
    return color;
  }

  return tinycolor(color).toRgbString();
}

/**
 * Converts a color from hsl format to rgb format.
 * @param color - HSL color values
 * @returns rgb color values
 * @beta
 */
export function hslToRgb(color: string | DecomposeColor) {
  const parts = decomposeColor(color);
  const { values } = parts;
  const h = values[0];
  const s = values[1] / 100;
  const l = values[2] / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number, k = (n + h / 30) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);

  let type = 'rgb';
  const rgb = [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];

  if (parts.type === 'hsla') {
    type += 'a';
    rgb.push(values[3]);
  }

  return recomposeColor({ type, values: rgb });
}

/**
 * Returns an object with the type and values of a color.
 *
 * Note: Does not support rgb % values.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @returns {object} - A MUI color object: {type: string, values: number[]}
 * @beta
 */
export function decomposeColor(color: string | DecomposeColor): DecomposeColor {
  // Idempotent
  if (typeof color !== 'string') {
    return color;
  }

  if (color.charAt(0) === '#') {
    return decomposeColor(hexToRgb(color));
  }

  const marker = color.indexOf('(');
  const type = color.substring(0, marker);

  if (['rgb', 'rgba', 'hsl', 'hsla', 'color'].indexOf(type) === -1) {
    throw new Error(
      `Unsupported '${color}' color. The following formats are supported: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()`
    );
  }

  let values: any = color.substring(marker + 1, color.length - 1);
  let colorSpace;

  if (type === 'color') {
    values = values.split(' ');
    colorSpace = values.shift();
    if (values.length === 4 && values[3].charAt(0) === '/') {
      values[3] = values[3].slice(1);
    }
    if (['srgb', 'display-p3', 'a98-rgb', 'prophoto-rgb', 'rec-2020'].indexOf(colorSpace) === -1) {
      throw new Error(
        `Unsupported ${colorSpace} color space. The following color spaces are supported: srgb, display-p3, a98-rgb, prophoto-rgb, rec-2020.`
      );
    }
  } else {
    values = values.split(',');
  }

  values = values.map((value: string) => parseFloat(value));
  return { type, values, colorSpace };
}

/**
 * Converts a color object with type and values to a string.
 * @param {object} color - Decomposed color
 * @param color.type - One of: 'rgb', 'rgba', 'hsl', 'hsla'
 * @param {array} color.values - [n,n,n] or [n,n,n,n]
 * @returns A CSS color string
 * @beta
 */
export function recomposeColor(color: DecomposeColor) {
  const { type, colorSpace } = color;
  let values = color.values;

  if (type.indexOf('rgb') !== -1) {
    // Only convert the first 3 values to int (i.e. not alpha)
    values = values.map((n: string, i: number) => (i < 3 ? parseInt(n, 10) : n));
  } else if (type.indexOf('hsl') !== -1) {
    values[1] = `${values[1]}%`;
    values[2] = `${values[2]}%`;
  }
  if (type.indexOf('color') !== -1) {
    values = `${colorSpace} ${values.join(' ')}`;
  } else {
    values = `${values.join(', ')}`;
  }

  return `${type}(${values})`;
}

/**
 * Calculates the contrast ratio between two colors.
 *
 * Formula: https://www.w3.org/TR/WCAG20-TECHS/G17.html#G17-tests
 * @param foreground - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @param background - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @param canvas - A CSS color that alpha based backgrounds blends into
 * @returns A contrast ratio value in the range 0 - 21.
 * @beta
 */
export function getContrastRatio(foreground: string, background: string, canvas?: string) {
  const lumA = getLuminance(foreground);
  const lumB = getLuminance(background, canvas);
  return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
}

/**
 * The relative brightness of any point in a color space,
 * normalized to 0 for darkest black and 1 for lightest white.
 *
 * Formula: https://www.w3.org/TR/WCAG20-TECHS/G17.html#G17-tests
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @param background - CSS color that needs to be take in to account to calculate luminance for colors with opacity
 * @returns The relative brightness of the color in the range 0 - 1
 * @beta
 */
export function getLuminance(color: string, background?: string) {
  const parts = decomposeColor(color);

  let rgb = parts.type === 'hsl' ? decomposeColor(hslToRgb(color)).values : parts.values;

  if (background && parts.type === 'rgba') {
    const backgroundParts = decomposeColor(background);
    const alpha = rgb[3];
    rgb[0] = rgb[0] * alpha + backgroundParts.values[0] * (1 - alpha);
    rgb[1] = rgb[1] * alpha + backgroundParts.values[1] * (1 - alpha);
    rgb[2] = rgb[2] * alpha + backgroundParts.values[2] * (1 - alpha);
  }

  const rgbNumbers = rgb.map((val: any) => {
    if (parts.type !== 'color') {
      val /= 255; // normalized
    }
    return val <= 0.03928 ? val / 12.92 : ((val + 0.055) / 1.055) ** 2.4;
  });

  // Truncate at 3 digits
  return Number((0.2126 * rgbNumbers[0] + 0.7152 * rgbNumbers[1] + 0.0722 * rgbNumbers[2]).toFixed(3));
}

/**
 * Darken or lighten a color, depending on its luminance.
 * Light colors are darkened, dark colors are lightened.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @param coefficient=0.15 - multiplier in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 * @beta
 */
export function emphasize(color: string, coefficient = 0.15) {
  return getLuminance(color) > 0.5 ? darken(color, coefficient) : lighten(color, coefficient);
}

/**
 * Set the absolute transparency of a color.
 * Any existing alpha values are overwritten.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @param value - value to set the alpha channel to in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 * @beta
 */
export function alpha(color: string, value: number) {
  if (color === '') {
    return '#000000';
  }

  value = clamp(value);

  // hex 3, hex 4 (w/alpha), hex 6, hex 8 (w/alpha)
  if (color[0] === '#') {
    if (color.length === 9) {
      color = color.substring(0, 7);
    } else if (color.length <= 5) {
      let c = '#';
      for (let i = 1; i < 4; i++) {
        c += color[i] + color[i];
      }
      color = c;
    }

    return (
      color +
      Math.round(value * 255)
        .toString(16)
        .padStart(2, '0')
    );
  }
  // rgb(, hsl(
  else if (color[3] === '(') {
    // rgb() and hsl() do not require the "a" suffix to accept alpha values in modern browsers:
    // https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/rgb()#accepts_alpha_value
    return color.replace(')', `, ${value})`);
  }
  // rgba(, hsla(
  else if (color[4] === '(') {
    return color.substring(0, color.lastIndexOf(',')) + `, ${value})`;
  }

  const parts = decomposeColor(color);

  if (parts.type === 'color') {
    parts.values[3] = `/${value}`;
  } else {
    parts.values[3] = value;
  }

  return recomposeColor(parts);
}

/**
 * Darkens a color.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @param coefficient - multiplier in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 * @beta
 */
export function darken(color: string, coefficient: number) {
  const parts = decomposeColor(color);
  coefficient = clamp(coefficient);

  if (parts.type.indexOf('hsl') !== -1) {
    parts.values[2] *= 1 - coefficient;
  } else if (parts.type.indexOf('rgb') !== -1 || parts.type.indexOf('color') !== -1) {
    for (let i = 0; i < 3; i += 1) {
      parts.values[i] *= 1 - coefficient;
    }
  }
  return recomposeColor(parts);
}

/**
 * Lightens a color.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @param coefficient - multiplier in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 * @beta
 */
export function lighten(color: string, coefficient: number) {
  const parts = decomposeColor(color);
  coefficient = clamp(coefficient);

  if (parts.type.indexOf('hsl') !== -1) {
    parts.values[2] += (100 - parts.values[2]) * coefficient;
  } else if (parts.type.indexOf('rgb') !== -1) {
    for (let i = 0; i < 3; i += 1) {
      parts.values[i] += (255 - parts.values[i]) * coefficient;
    }
  } else if (parts.type.indexOf('color') !== -1) {
    for (let i = 0; i < 3; i += 1) {
      parts.values[i] += (1 - parts.values[i]) * coefficient;
    }
  }

  return recomposeColor(parts);
}

/**
 * given foreground and background colors, returns the color of the foreground color on the background color.
 * this is valuable for foreground colors with alpha.
 *
 * adapted from https://github.com/scttcper/tinycolor/blob/2927a9d2aa03e037486a79a295542a7848621691/src/index.ts#L583-L594
 *
 * @param foreground
 * @param background
 * @returns a tinycolor instance
 */
export const onBackground = (
  foreground: tinycolor.ColorInput,
  background: tinycolor.ColorInput
): tinycolor.Instance => {
  const fg = tinycolor(foreground).toRgb();
  const bg = tinycolor(background).toRgb();
  const alpha = fg.a + bg.a * (1 - fg.a);

  return tinycolor({
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / alpha,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / alpha,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / alpha,
    a: alpha,
  });
};

interface DecomposeColor {
  type: string;
  values: any;
  colorSpace?: string;
}

export const colorManipulator = {
  clamp,
  hexToRgb,
  rgbToHex,
  asHexString,
  asRgbString,
  hslToRgb,
  decomposeColor,
  recomposeColor,
  getContrastRatio,
  getLuminance,
  emphasize,
  alpha,
  darken,
  lighten,
  onBackground,
};
