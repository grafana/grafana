import { createTheme, colorManipulator, type GrafanaTheme2 } from '@grafana/data';

import { getTagColor, getTagColorVariables, getTransparentOutlineColor } from './tags';

const TARGET_CONTRAST = 6;
const MIN_CONTRAST = 4.5;
// The text is mixed with 0.1% of the theme text color to pick between the two in CSS, which shifts contrast slightly.
const TOLERANCE = 0.02;

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

const toGamma = (value: number) => (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055);
const toLinear = (value: number) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);

/** Splits on top-level occurrences of `separator`, ignoring any inside parentheses. */
function splitTopLevel(expression: string, separator: string) {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of expression) {
    depth += char === '(' ? 1 : char === ')' ? -1 : 0;
    if (char === separator && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  return [...parts, current.trim()];
}

/** Resolves `color(from <source> srgb-linear r g b / a)` and `rgb(from <source> r g b / a)` against a source. */
function resolveRelativeColor(color: string, source: Linear, sourceAlpha: number): { rgb: Linear; alpha: number } {
  const linear = color.match(/^color\(from .+? srgb-linear (.+)\)$/);
  const rgb255 = color.match(/^rgb\(from .+? r g b \/ (.+)\)$/);
  if (rgb255) {
    return { rgb: source, alpha: evaluate(rgb255[1], source, sourceAlpha) };
  }
  if (!linear) {
    throw new Error(`Unexpected color: ${color}`);
  }

  const [r, g, b, slash, alpha] = splitTopLevel(linear[1], ' ');
  if (slash !== '/') {
    throw new Error(`Expected an alpha channel: ${color}`);
  }
  return {
    rgb: [r, g, b].map((channel) => evaluate(channel, source, sourceAlpha)) as Linear,
    alpha: evaluate(alpha, source, sourceAlpha),
  };
}

/**
 * Resolves the output of a visibility pick: `rgb(from color-mix(in srgb, <visible>, <fallback> 0.1%) r g b / <alpha>)`.
 * `fallback` is the theme color the browser would parse; the mix uses premultiplied alpha, as CSS does.
 */
function resolveColor(
  color: string,
  source: Linear,
  sourceAlpha: number,
  fallback: { rgb: Linear; alpha: number }
): { rgb: Linear; alpha: number } {
  const match = color.match(/^rgb\(from color-mix\(in srgb, (.+), (.+) 0\.1%\) r g b \/ calc\((.+)\)\)$/);
  if (!match) {
    throw new Error(`Unexpected color: ${color}`);
  }

  const [mixArgs, alphaExpression] = [match[1] + ', ' + match[2], match[3]];
  const [visibleExpression] = splitTopLevel(mixArgs, ',');
  const visible = resolveRelativeColor(visibleExpression, source, sourceAlpha);

  const mixedAlpha = 0.999 * visible.alpha + 0.001 * fallback.alpha;
  const mixed = [0, 1, 2].map((index) =>
    mixedAlpha === 0
      ? 0
      : toLinear(
          (0.999 * visible.alpha * toGamma(visible.rgb[index]) +
            0.001 * fallback.alpha * toGamma(fallback.rgb[index])) /
            mixedAlpha
        )
  ) as Linear;
  return { rgb: mixed, alpha: evaluate(alphaExpression, mixed, mixedAlpha) };
}

function themeColorToLinear(color: string): { rgb: Linear; alpha: number } {
  const { values } = colorManipulator.decomposeColor(colorManipulator.asRgbString(color));
  const hex = `#${values
    .slice(0, 3)
    .map((value: number) => Math.round(value).toString(16).padStart(2, '0'))
    .join('')}`;
  return { rgb: hexToLinear(hex), alpha: values[3] ?? 1 };
}

function resolveBackgroundAlpha(background: string, sourceAlpha: number) {
  const match = background.match(/ r g b \/ (.+)\)$/);
  if (!match) {
    throw new Error(`Unexpected background: ${background}`);
  }
  return evaluate(match[1], black, sourceAlpha);
}

/** Resolves tag text against an opaque source and the theme's text color. */
const resolveText = (text: string, source: Linear, theme: GrafanaTheme2, sourceAlpha = 1) =>
  resolveColor(text, source, sourceAlpha, themeColorToLinear(theme.colors.text.primary));

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
    expect(contrast(linear, resolveText(text, linear, theme).rgb)).toBeGreaterThanOrEqual(required - TOLERANCE);
  });
});

it.each(['#fde725', '#3b528b', '#21918c', '#ffffff'])(
  'resolves the variable-based text for %s to the same color as the inline text',
  (source) => {
    const theme = createTheme();
    const { '--tag-text': variableText } = getTagColorVariables(source, theme);
    const linear = hexToLinear(source);

    expect(variableText).toContain('var(--tag-background)');
    expect(resolveText(variableText.replace('var(--tag-background)', source), linear, theme)).toEqual(
      resolveText(getTagColor(source, theme).text, linear, theme)
    );
  }
);

it('keeps the hue of the background when the target contrast is reachable', () => {
  const theme = createTheme();
  const source = hexToLinear('#fde725');
  const [r, g, b] = resolveText(getTagColor('#fde725', theme).text, source, theme).rgb;

  // The 0.1% theme text mix perturbs small channels, so compare the ratios relative to the source ratios.
  expect(r / g / (source[0] / source[1])).toBeCloseTo(1, 1);
  expect(g / b / (source[1] / source[2])).toBeCloseTo(1, 1);
});

describe.each(['dark', 'light'] as const)('transparent tag colors in %s mode', (mode) => {
  const theme = createTheme({ colors: { mode } });
  const themeText = themeColorToLinear(theme.colors.text.primary);

  it('uses a transparent background and the theme text for a fully transparent color', () => {
    const { background, text } = getTagColor('transparent', theme);
    const resolved = resolveText(text, black, theme, 0);

    expect(resolveBackgroundAlpha(background, 0)).toBe(0);
    resolved.rgb.forEach((channel, index) => expect(channel).toBeCloseTo(themeText.rgb[index], 5));
    expect(resolved.alpha).toBeCloseTo(themeText.alpha);
  });

  it.each([1, 0.5, 0.001])('keeps a fill and contrasting text for alpha %s', (alpha) => {
    const { background, text } = getTagColor('rgb(255, 0, 0)', theme);
    const red = hexToLinear('#ff0000');

    expect(resolveBackgroundAlpha(background, alpha)).toBe(1);
    expect(resolveText(text, red, theme, alpha)).toEqual({
      rgb: resolveText(getTagColor('#ff0000', theme).text, red, theme).rgb,
      alpha: 1,
    });
  });

  it('shows the outline only for a fully transparent color', () => {
    const border = themeColorToLinear(theme.colors.border.strong);
    const outline = getTransparentOutlineColor('transparent', theme.colors.border.strong);

    expect(resolveColor(outline, black, 0, border).alpha).toBeCloseTo(border.alpha);
    expect(resolveColor(outline, black, 1, border).alpha).toBe(0);
  });
});

it('uses palette colors directly for an index', () => {
  const theme = createTheme();
  expect(getTagColor(1, theme)).toMatchObject(theme.components.tag.colors[1]);
});
