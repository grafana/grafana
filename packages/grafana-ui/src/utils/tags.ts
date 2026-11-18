import { type GrafanaTheme2, colorManipulator } from '@grafana/data';
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
  return {
    background: `rgb(from ${color} r g b / ${OPAQUE})`,
    text: `color(from ${color} srgb-linear ${getTextChannels(theme).join(' ')})`,
  };
}

// 1 for any visible color, 0 for a fully transparent one. Read from the relative color source, so the browser
// handles every color format. The large factor makes clamp() act as a step function.
const OPAQUE = 'clamp(0, alpha * 1e9, 1)';

const TARGET_CONTRAST = 6;
// WCAG 2 relative luminance, from linear sRGB channels.
const LUMINANCE = '(0.2126 * r + 0.7152 * g + 0.0722 * b)';
// Luminance where black and white text have equal contrast: (Y + 0.05) / 0.05 = 1.05 / (Y + 0.05).
const CROSSOVER_LUMINANCE = Math.sqrt(1.05 * 0.05) - 0.05;
// 1 above the crossover, so darker text wins; 0 below it, so lighter text wins.
const USE_DARKER = `clamp(0, (${LUMINANCE} - ${CROSSOVER_LUMINANCE.toFixed(4)}) * 1e9, 1)`;
// Scale linear channels toward black until text luminance is (Y + 0.05) / target - 0.05.
const DARKER_SCALE = `max(0, ((${LUMINANCE} + 0.05) / ${TARGET_CONTRAST} - 0.05) / max(${LUMINANCE}, 1e-6))`;
// Mix linear channels toward white until text luminance is target * (Y + 0.05) - 0.05.
const LIGHTER_MIX = `clamp(0, (${TARGET_CONTRAST} * (${LUMINANCE} + 0.05) - 0.05 - ${LUMINANCE}) / max(1 - ${LUMINANCE}, 1e-6), 1)`;

const FALLBACK_TEXT = 'rgb(247, 248, 250)';

/** A theme color as linear sRGB channels and alpha, to use as literals inside relative color math. */
function toLinear(color: string): [number, number, number, number] {
  const { values } = colorManipulator.decomposeColor(colorManipulator.asRgbString(color));
  const [r, g, b] = values.slice(0, 3).map((value: number) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return [r, g, b, values[3] ?? 1];
}

const round = (value: number) => Number(value.toFixed(6));

/**
 * Per-channel text math: same-hue contrasting text for a visible background, and the theme text for a
 * transparent one. The values use only relative color keywords and literals, so they hold as raw tokens and
 * resolve inside whichever relative color uses them.
 */
function getTextChannels(theme?: GrafanaTheme2) {
  const fallback = toLinear(theme?.colors.text.primary ?? FALLBACK_TEXT).map(round);
  const rgb = (['r', 'g', 'b'] as const).map((channel, index) => {
    const contrasting = `${USE_DARKER} * ${channel} * ${DARKER_SCALE} + (1 - ${USE_DARKER}) * (${channel} + ${LIGHTER_MIX} * (1 - ${channel}))`;
    return `calc(${OPAQUE} * (${contrasting}) + (1 - ${OPAQUE}) * ${fallback[index]})`;
  });
  return [...rgb, `/ calc(${OPAQUE} + (1 - ${OPAQUE}) * ${fallback[3]})`];
}

/**
 * Text channel custom properties for styles that read `var(--tag-text)`. They depend on the theme only, so a
 * tag's class stays the same for every color: only the inline color variables change.
 */
export function getTagTextChannelVariables(theme?: GrafanaTheme2) {
  const [r, g, b, alpha] = getTextChannels(theme);
  return { '--tag-text-r': r, '--tag-text-g': g, '--tag-text-b': b, '--tag-text-alpha': alpha };
}

const TEXT_FROM_VARIABLES =
  'color(from var(--tag-background) srgb-linear var(--tag-text-r) var(--tag-text-g) var(--tag-text-b) var(--tag-text-alpha))';

/**
 * A color that is only visible when `color` is fully transparent, for example to outline a tag that has no
 * fill. Rendered as an inset box shadow, it does not change the tag size.
 */
export function getTransparentOutlineColor(color: string, outline: string) {
  const [r, g, b, alpha] = toLinear(outline).map(round);
  return `color(from ${color} srgb-linear ${r} ${g} ${b} / calc((1 - ${OPAQUE}) * ${alpha}))`;
}

export interface TagColorVariables {
  '--tag-background': string;
  '--tag-text': string;
}

/**
 * Returns the tag colors as inline custom properties, for styles that read `var(--tag-background)` and
 * `var(--tag-text)` and include {@link getTagTextChannelVariables}. `--tag-text` is always set so a tag
 * never inherits one from an ancestor.
 */
export function getTagColorVariables(color: number | string, theme?: GrafanaTheme2): TagColorVariables {
  if (typeof color === 'string') {
    return { '--tag-background': `rgb(from ${color} r g b / ${OPAQUE})`, '--tag-text': TEXT_FROM_VARIABLES };
  }

  const { background, text } = getTagColor(color, theme);
  return { '--tag-background': background, '--tag-text': text };
}

function djb2(str: string) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash;
}
