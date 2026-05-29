import { palette } from '@grafana/data/unstable';

const TAG_COLORS = [
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
  palette.coral200,
  palette.peach200,
  palette.amber200,
  palette.lime200,
  palette.sage200,
  palette.teal200,
  palette.sky200,
  palette.blue200,
  palette.violet200,
  palette.lavender200,
  palette.rose200,
];

const TAG_BORDER_COLORS = [
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
