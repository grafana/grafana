import { type GrafanaTheme2 } from '@grafana/data';
import { DEFAULT_TAG_COLORS } from '@grafana/data/unstable';

function getTagColorIndexFromName(name = '', theme?: GrafanaTheme2): number {
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

export function getTagColor(index: number, theme?: GrafanaTheme2) {
  const colors = theme?.components.tag.colors ?? DEFAULT_TAG_COLORS;
  const { background, text } = colors[index];

  const result = { background, text };

  // this maintains backwards runtime compatibility for a little bit
  // TODO remove in Grafana 14
  Object.assign(result, { color: background, borderColor: text });

  return result;
}

function djb2(str: string) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash;
}
