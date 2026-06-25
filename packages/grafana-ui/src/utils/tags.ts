import { palette } from '@grafana/data/unstable';

const TAG_COLORS = [
  palette.coral900,
  palette.peach900,
  palette.amber900,
  palette.lime900,
  palette.sage900,
  palette.teal900,
  palette.sky900,
  palette.blue900,
  palette.violet900,
  palette.lavender900,
  palette.rose900,
  palette.coral800,
  palette.peach800,
  palette.amber800,
  palette.lime800,
  palette.sage800,
  palette.teal800,
  palette.sky800,
  palette.blue800,
  palette.violet800,
  palette.lavender800,
  palette.rose800,
];

const TAG_BORDER_COLORS = [
  palette.coral400,
  palette.peach400,
  palette.amber400,
  palette.lime400,
  palette.sage400,
  palette.teal400,
  palette.sky400,
  palette.blue400,
  palette.violet400,
  palette.lavender400,
  palette.rose400,
  palette.coral300,
  palette.peach300,
  palette.amber300,
  palette.lime300,
  palette.sage300,
  palette.teal300,
  palette.sky300,
  palette.blue300,
  palette.violet300,
  palette.lavender300,
  palette.rose300,
];

// TODO remove when visual design refresh has been rolled out
const TAG_COLORS_LEGACY = [
  '#D32D20',
  '#1E72B8',
  '#B240A2',
  '#705DA0',
  '#466803',
  '#497A3C',
  '#3D71AA',
  '#B15415',
  '#890F02',
  '#6E6E6E',
  '#0A437C',
  '#6D1F62',
  '#584477',
  '#4C7A3F',
  '#2F4F4F',
  '#BF1B00',
  '#7662B1',
  '#8A2EB8',
  '#517A00',
  '#000000',
  '#3F6833',
  '#2F575E',
  '#99440A',
  '#AE561A',
  '#0E4AB4',
  '#58140C',
  '#052B51',
  '#511749',
  '#3F2B5B',
];

// TODO remove when visual design refresh has been rolled out
const TAG_BORDER_COLORS_LEGACY = [
  '#FF7368',
  '#459EE7',
  '#E069CF',
  '#9683C6',
  '#6C8E29',
  '#76AC68',
  '#6AA4E2',
  '#E7823D',
  '#AF3528',
  '#9B9B9B',
  '#3069A2',
  '#934588',
  '#7E6A9D',
  '#88C477',
  '#557575',
  '#E54126',
  '#A694DD',
  '#B054DE',
  '#8FC426',
  '#262626',
  '#658E59',
  '#557D84',
  '#BF6A30',
  '#FF9B53',
  '#3470DA',
  '#7E3A32',
  '#2B5177',
  '#773D6F',
  '#655181',
];

export function getTagColorIndexFromName(name = '', visualRefreshEnabled = false): number {
  const map = visualRefreshEnabled ? TAG_COLORS : TAG_COLORS_LEGACY;
  const hash = djb2(name.toLowerCase());
  return Math.abs(hash % map.length);
}

/**
 * Returns tag badge background and border colors based on hashed tag name.
 * @param name tag name
 */
export function getTagColorsFromName(
  name = '',
  isLight = false,
  visualRefreshEnabled = false
): { color: string; borderColor: string } {
  const index = getTagColorIndexFromName(name, visualRefreshEnabled);
  return getTagColor(index, isLight, visualRefreshEnabled);
}

export function getTagColor(
  index: number,
  isLight = false,
  visualRefreshEnabled = false
): { color: string; borderColor: string } {
  let colors = TAG_COLORS_LEGACY;
  if (visualRefreshEnabled) {
    // Reverse order of colors in light themes (dark text on light background)
    if (isLight) {
      colors = TAG_BORDER_COLORS;
    } else {
      colors = TAG_COLORS;
    }
  }
  let borderColors = TAG_BORDER_COLORS_LEGACY;
  if (visualRefreshEnabled) {
    // Reverse order of colors in light themes (dark text on light background)
    if (isLight) {
      borderColors = TAG_COLORS;
    } else {
      borderColors = TAG_BORDER_COLORS;
    }
  }
  return { color: colors[index], borderColor: borderColors[index] };
}

function djb2(str: string) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash;
}
