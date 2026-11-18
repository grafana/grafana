import { createTheme } from '@grafana/data';

import { TAG_TEXT_CHANNEL_VARIABLES, getTagColor, getTagColorVariables } from './tags';

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

const cssClamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

/** jsdom does not resolve relative colors, so evaluate the emitted CSS math the way a browser would. */
function resolveTextColor(text: string, source: Linear): Linear {
  const match = text.match(/^color\(from \S+ srgb-linear (.+) \/ 1\)$/);
  if (!match) {
    throw new Error(`Unexpected text color: ${text}`);
  }

  const [r, g, b] = source;
  return splitChannels(match[1]).map((channel) =>
    new Function('r', 'g', 'b', 'clamp', 'max', `return ${channel.replace(/\bcalc\(/g, '(')};`)(
      r,
      g,
      b,
      cssClamp,
      Math.max
    )
  ) as Linear;
}

const black: Linear = [0, 0, 0];
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

    expect(background).toBe(`rgb(from ${source} r g b / 1)`);
    expect(contrast(linear, resolveTextColor(text, linear))).toBeGreaterThanOrEqual(required - 1e-6);
  });
});

it.each(['#fde725', '#3b528b', '#21918c', '#ffffff'])(
  'resolves the variable-based text for %s to the same color as the inline text',
  (source) => {
    const { '--tag-text': variableText } = getTagColorVariables(source);
    const expanded = Object.entries(TAG_TEXT_CHANNEL_VARIABLES).reduce(
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

it.each(['transparent', 'rgba(0,0,0,0)', 'rgba(255, 255, 255, 0)', '#ffffff00', 'hsl(0 0% 0% / 0)'])(
  'keeps %s transparent with theme text',
  (color) => {
    const theme = createTheme({ colors: { mode: 'light' } });
    expect(getTagColor(color, theme)).toEqual({
      background: 'rgba(0,0,0,0)',
      text: theme.colors.text.primary,
      color: 'rgba(0,0,0,0)',
      borderColor: theme.colors.text.primary,
    });
  }
);

it('uses palette colors directly for an index', () => {
  const theme = createTheme();
  expect(getTagColor(1, theme)).toMatchObject(theme.components.tag.colors[1]);
});
