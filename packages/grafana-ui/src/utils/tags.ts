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

  // Opaque tints keep contrast independent of table striping and the surface behind a tag.
  base.setAlpha(1);
  const isDark = theme?.isDark ?? true;
  return {
    background: tinycolor.mix(base, isDark ? '#000' : '#fff', isDark ? 85 : 90).toRgbString(),
    text: tinycolor.mix(base, isDark ? '#fff' : '#000', 65).toRgbString(),
  };
}

function djb2(str: string) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash;
}
