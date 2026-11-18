import { createTheme, colorManipulator } from '@grafana/data';

import { getTagColor, getTagColorVariables, getTagTextChannelVariables, getTransparentOutlineColor } from './tags';

const TARGET_CONTRAST = 6;
const MIN_CONTRAST = 4.5;

type Linear = [number, number, number];

function hexToLinear(hex: string): Linear {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => parseInt(channel, 16) / 255);
  return channels.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)) as Linear;
}

function luminance([r, g, b]: Linear) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Linear, b: Linear) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Splits the channel expressions of a relative color on top-level whitespace. */
function splitChannels(expression: string) {
  const channels: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of expression) {
    depth += char === '(' ? 1 : char === ')' ? -1 : 0;
    if (char === ' ' && depth === 0) {
      channels.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  return [...channels, current];
}

const black: Linear = [0, 0, 0];
const cssClamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

function evaluate(expression: string, [r, g, b]: Linear, alpha: number): number {
  return new Function('r', 'g', 'b', 'alpha', 'clamp', 'max', `return ${expression.replace(/\bcalc\(/g, '(')};`)(
    r,
    g,
    b,
    alpha,
    cssClamp,
    Math.max
  );
}

/** jsdom does not resolve relative colors, so evaluate the emitted CSS math the way a browser would. */
function resolveColor(color: string, source: Linear, sourceAlpha = 1): { rgb: Linear; alpha: number } {
  const match = color.match(/^color\(from .+? srgb-linear (.+)\)$/);
  if (!match) {
    throw new Error(`Unexpected color: ${color}`);
  }

  const [r, g, b, slash, alpha] = splitChannels(match[1]);
  if (slash !== '/') {
    throw new Error(`Expected an alpha channel: ${color}`);
  }
  return {
    rgb: [r, g, b].map((channel) => evaluate(channel, source, sourceAlpha)) as Linear,
    alpha: evaluate(alpha, source, sourceAlpha),
  };
}

const resolveTextColor = (text: string, source: Linear) => resolveColor(text, source).rgb;

function resolveBackgroundAlpha(background: string, sourceAlpha: number) {
  const match = background.match(/ r g b \/ (.+)\)$/);
  if (!match) {
    throw new Error(`Unexpected background: ${background}`);
  }
  return evaluate(match[1], black, sourceAlpha);
}

function themeColorToLinear(color: string): { rgb: Linear; alpha: number } {
  const { values } = colorManipulator.decomposeColor(colorManipulator.asRgbString(color));
  const hex = `#${values
    .slice(0, 3)
    .map((value: number) => Math.round(value).toString(16).padStart(2, '0'))
    .join('')}`;
  return { rgb: hexToLinear(hex), alpha: values[3] ?? 1 };
}

const white: Linear = [1, 1, 1];

describe.each(['dark', 'light'] as const)('contrasting tag colors in %s mode', (mode) => {
  const theme = createTheme({ colors: { mode } });
  const sources = [
    ...theme.components.tag.colors.map(({ background }) => background).filter((color) => /^#[0-9a-f]{6}$/i.test(color)),
    '#ffffff',
    '#000000',
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#ffff00',
    '#00ffff',
    '#ff00ff',
    '#808080',
    '#7f8081',
    '#440154',
    '#21918c',
    '#fde725',
    '#a352cc',
  ];

  it.each(sources)('keeps %s as an opaque background with accessible text', (source) => {
    const { background, text } = getTagColor(source, theme);
    const linear = hexToLinear(source);
    const bestContrast = Math.max(contrast(linear, black), contrast(linear, white));
    const required = bestContrast >= TARGET_CONTRAST ? TARGET_CONTRAST : MIN_CONTRAST;

    expect(background).toBe(`rgb(from ${source} r g b / clamp(0, alpha * 1e9, 1))`);
    expect(resolveBackgroundAlpha(background, 1)).toBe(1);
    expect(contrast(linear, resolveTextColor(text, linear))).toBeGreaterThanOrEqual(required - 1e-6);
  });
});

it.each(['#fde725', '#3b528b', '#21918c', '#ffffff'])(
  'resolves the variable-based text for %s to the same color as the inline text',
  (source) => {
    const { '--tag-text': variableText } = getTagColorVariables(source);
    const expanded = Object.entries(getTagTextChannelVariables()).reduce(
      (text, [name, value]) => text.replace(`var(${name})`, value),
      variableText
    );
    const linear = hexToLinear(source);

    expect(resolveTextColor(expanded, linear)).toEqual(resolveTextColor(getTagColor(source).text, linear));
  }
);

it('keeps the hue of the background when the target contrast is reachable', () => {
  const source = hexToLinear('#fde725');
  const [r, g, b] = resolveTextColor(getTagColor('#fde725').text, source);

  expect(r / g).toBeCloseTo(source[0] / source[1]);
  expect(g / b).toBeCloseTo(source[1] / source[2]);
});

describe.each(['dark', 'light'] as const)('transparent tag colors in %s mode', (mode) => {
  const theme = createTheme({ colors: { mode } });
  const themeText = themeColorToLinear(theme.colors.text.primary);

  it('uses a transparent background and the theme text for a fully transparent color', () => {
    const { background, text } = getTagColor('transparent', theme);
    const resolved = resolveColor(text, black, 0);

    expect(resolveBackgroundAlpha(background, 0)).toBe(0);
    resolved.rgb.forEach((channel, index) => expect(channel).toBeCloseTo(themeText.rgb[index], 5));
    expect(resolved.alpha).toBeCloseTo(themeText.alpha);
  });

  it.each([1, 0.5, 0.001])('keeps a fill and contrasting text for alpha %s', (alpha) => {
    const { background, text } = getTagColor('rgb(255, 0, 0)', theme);
    const red = hexToLinear('#ff0000');

    expect(resolveBackgroundAlpha(background, alpha)).toBe(1);
    expect(resolveColor(text, red, alpha)).toEqual({
      rgb: resolveTextColor(getTagColor('#ff0000').text, red),
      alpha: 1,
    });
  });

  it('shows the outline only for a fully transparent color', () => {
    const border = themeColorToLinear(theme.colors.border.strong);
    const outline = getTransparentOutlineColor('transparent', theme.colors.border.strong);

    expect(resolveColor(outline, black, 0).alpha).toBeCloseTo(border.alpha);
    expect(resolveColor(outline, black, 1).alpha).toBe(0);
  });
});

it('uses palette colors directly for an index', () => {
  const theme = createTheme();
  expect(getTagColor(1, theme)).toMatchObject(theme.components.tag.colors[1]);
});
