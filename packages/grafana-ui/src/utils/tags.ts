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
  return {
    background: `rgb(from ${color} r g b / ${OPAQUE})`,
    text: getContrastingText(color, theme),
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

// Same-hue contrasting text channels in linear sRGB. They use only relative color keywords and literals, so they
// resolve against whichever color they are applied to. The alpha is OPAQUE so a transparent source stays
// transparent, which is what lets pickByVisibility swap in the fallback.
const CONTRASTING_CHANNELS = `${(['r', 'g', 'b'] as const)
  .map(
    (channel) =>
      `calc(${USE_DARKER} * ${channel} * ${DARKER_SCALE} + (1 - ${USE_DARKER}) * (${channel} + ${LIGHTER_MIX} * (1 - ${channel})))`
  )
  .join(' ')} / ${OPAQUE}`;

/**
 * Picks `visible` for a visible tag color and `fallback` for a fully transparent one, resolved in CSS so no
 * color has to be parsed in JS. `visible` must have alpha OPAQUE. Mixing in 0.1% of `fallback` leaves `visible`
 * unchanged when it is opaque, and yields exactly `fallback` when `visible` is transparent. The final alpha is
 * a step function of that mix: 1 (or 0 with `hideWhenVisible`) when visible, and the fallback's own alpha otherwise.
 */
function pickByVisibility(visible: string, fallback: string, { hideWhenVisible = false } = {}) {
  const whenVisible = hideWhenVisible ? '0' : 'clamp(0, (alpha - 0.5) * 1e9, 1)';
  const whenTransparent = 'clamp(0, (0.5 - alpha) * 1e9, 1) * alpha * 1000';
  return `rgb(from color-mix(in srgb, ${visible}, ${fallback} 0.1%) r g b / calc(${whenVisible} + ${whenTransparent}))`;
}

function getContrastingText(source: string, theme?: GrafanaTheme2) {
  return pickByVisibility(
    `color(from ${source} srgb-linear ${CONTRASTING_CHANNELS})`,
    theme?.colors.text.primary ?? FALLBACK_TEXT
  );
}

/**
 * A color that is only visible when `color` is fully transparent, for example to outline a tag that has no
 * fill. Rendered as an inset box shadow, it does not change the tag size.
 */
export function getTransparentOutlineColor(color: string, outline: string) {
  return pickByVisibility(`rgb(from ${color} r g b / ${OPAQUE})`, outline, { hideWhenVisible: true });
}

export interface TagColorVariables {
  '--tag-background': string;
  '--tag-text': string;
}

/**
 * Returns the tag colors as inline custom properties, for styles that read `var(--tag-background)` and
 * `var(--tag-text)`. `--tag-text` is always set so a tag never inherits one from an ancestor.
 */
export function getTagColorVariables(color: number | string, theme?: GrafanaTheme2): TagColorVariables {
  if (typeof color === 'string') {
    return {
      '--tag-background': `rgb(from ${color} r g b / ${OPAQUE})`,
      '--tag-text': getContrastingText('var(--tag-background)', theme),
    };
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
