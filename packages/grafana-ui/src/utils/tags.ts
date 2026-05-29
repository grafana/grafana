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

export function getTagColorIndexFromName(name = ''): number {
  const hash = djb2(name.toLowerCase());
  return Math.abs(hash % TAG_COLORS.length);
}

/**
 * Returns tag badge background and border colors based on hashed tag name.
 * @param name tag name
 */
export function getTagColorsFromName(name = ''): { color: string; borderColor: string } {
  const index = getTagColorIndexFromName(name);
  return getTagColor(index);
}

export function getTagColor(index: number): { color: string; borderColor: string } {
  return { color: TAG_COLORS[index], borderColor: TAG_BORDER_COLORS[index] };
}

function djb2(str: string) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash;
}

export default {
  getTagColorsFromName,
};
