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
    typeof index === 'string' ? getContrastingTagColors(index, theme) : colors[Math.abs(index % colors.length)];

  const result = { background, text };

  // this maintains backwards runtime compatibility for a little bit
  // TODO remove in Grafana 14
  Object.assign(result, { color: background, borderColor: text });

  return result;
}

function getContrastingTagColors(color: string, theme?: GrafanaTheme2) {
  if (isFullyTransparent(color)) {
    return { background: 'rgba(0,0,0,0)', text: theme?.colors.text.primary ?? 'rgb(247, 248, 250)' };
  }

  return { background: `rgb(from ${color} r g b / 1)`, text: getContrastingTextColor(color) };
}

const TARGET_CONTRAST = 6;
// WCAG 2 relative luminance, from linear sRGB channels.
const LUMINANCE = '(0.2126 * r + 0.7152 * g + 0.0722 * b)';
// Luminance where black and white text have equal contrast: (Y + 0.05) / 0.05 = 1.05 / (Y + 0.05).
const CROSSOVER_LUMINANCE = Math.sqrt(1.05 * 0.05) - 0.05;
// 1 above the crossover, so darker text wins; 0 below it, so lighter text wins. The large factor makes
// clamp() act as a step function.
const USE_DARKER = `clamp(0, (${LUMINANCE} - ${CROSSOVER_LUMINANCE.toFixed(4)}) * 1e9, 1)`;
// Scale linear channels toward black until text luminance is (Y + 0.05) / target - 0.05.
const DARKER_SCALE = `max(0, ((${LUMINANCE} + 0.05) / ${TARGET_CONTRAST} - 0.05) / max(${LUMINANCE}, 1e-6))`;
// Mix linear channels toward white until text luminance is target * (Y + 0.05) - 0.05.
const LIGHTER_MIX = `clamp(0, (${TARGET_CONTRAST} * (${LUMINANCE} + 0.05) - 0.05 - ${LUMINANCE}) / max(1 - ${LUMINANCE}, 1e-6), 1)`;

function getContrastingChannel(channel: 'r' | 'g' | 'b') {
  return `calc(${USE_DARKER} * ${channel} * ${DARKER_SCALE} + (1 - ${USE_DARKER}) * (${channel} + ${LIGHTER_MIX} * (1 - ${channel})))`;
}

const CONTRASTING_CHANNELS = (['r', 'g', 'b'] as const).map(getContrastingChannel).join(' ');

/**
 * Per-channel contrast math for tag text, as custom properties. The values use only the relative color
 * channel keywords, so they hold as raw tokens and resolve inside whichever relative color uses them.
 * This lets a tag's styles stay the same for every color: only the inline color variables change.
 */
export const TAG_TEXT_CHANNEL_VARIABLES = {
  '--tag-text-r': getContrastingChannel('r'),
  '--tag-text-g': getContrastingChannel('g'),
  '--tag-text-b': getContrastingChannel('b'),
};

const CONTRASTING_TEXT_FROM_VARIABLES =
  'color(from var(--tag-background) srgb-linear var(--tag-text-r) var(--tag-text-g) var(--tag-text-b) / 1)';

export interface TagColorVariables {
  '--tag-background': string;
  '--tag-text': string;
}

/**
 * Returns the tag colors as inline custom properties, for styles that read `var(--tag-background)` and
 * `var(--tag-text)` and include {@link TAG_TEXT_CHANNEL_VARIABLES}. `--tag-text` is always set so a tag
 * never inherits one from an ancestor.
 */
export function getTagColorVariables(color: number | string, theme?: GrafanaTheme2): TagColorVariables {
  if (typeof color === 'string' && !isFullyTransparent(color)) {
    return { '--tag-background': `rgb(from ${color} r g b / 1)`, '--tag-text': CONTRASTING_TEXT_FROM_VARIABLES };
  }

  const { background, text } = getTagColor(color, theme);
  return { '--tag-background': background, '--tag-text': text };
}

/**
 * Builds a same-hue text color for an opaque background with CSS relative color syntax, so the browser
 * resolves the color instead of JavaScript. Scaling or mixing in linear sRGB keeps the channel ratios,
 * and so the hue, of the background. The text targets 6:1 contrast and falls back to black or white
 * when the target is out of reach, which still gives at least 4.5:1.
 */
function getContrastingTextColor(background: string) {
  return `color(from ${background} srgb-linear ${CONTRASTING_CHANNELS} / 1)`;
}

const ZERO_ALPHA = /^(?:transparent|#[0-9a-f]{3}0|#[0-9a-f]{6}00|(?:rgb|hsl)a?\(.*[,/]\s*0(?:\.0*)?%?\s*\))$/i;

export function isFullyTransparent(color: string) {
  return ZERO_ALPHA.test(color.trim());
}

function djb2(str: string) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash;
}
