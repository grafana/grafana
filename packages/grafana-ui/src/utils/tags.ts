import { palette } from '@grafana/data/unstable';

const TAG_COLORS = [
  [palette.coral900, palette.coral400],
  [palette.peach900, palette.peach400],
  [palette.amber900, palette.amber400],
  [palette.lime900, palette.lime400],
  [palette.sage900, palette.sage400],
  [palette.teal900, palette.teal400],
  [palette.sky900, palette.sky400],
  [palette.blue900, palette.blue400],
  [palette.violet900, palette.violet400],
  [palette.lavender900, palette.lavender400],
  [palette.rose900, palette.rose400],
  [palette.coral800, palette.coral300],
  [palette.peach800, palette.peach300],
  [palette.amber800, palette.amber300],
  [palette.lime800, palette.lime300],
  [palette.sage800, palette.sage300],
  [palette.teal800, palette.teal300],
  [palette.sky800, palette.sky300],
  [palette.blue800, palette.blue300],
  [palette.violet800, palette.violet300],
  [palette.lavender800, palette.lavender300],
  [palette.rose800, palette.rose300],
] as const;

// TODO remove when visual design refresh has been rolled out
const TAG_COLORS_LEGACY = [
  ['#D32D20', '#FF7368'],
  ['#1E72B8', '#459EE7'],
  ['#B240A2', '#E069CF'],
  ['#705DA0', '#9683C6'],
  ['#466803', '#6C8E29'],
  ['#497A3C', '#76AC68'],
  ['#3D71AA', '#6AA4E2'],
  ['#B15415', '#E7823D'],
  ['#890F02', '#AF3528'],
  ['#6E6E6E', '#9B9B9B'],
  ['#0A437C', '#3069A2'],
  ['#6D1F62', '#934588'],
  ['#584477', '#7E6A9D'],
  ['#4C7A3F', '#88C477'],
  ['#2F4F4F', '#557575'],
  ['#BF1B00', '#E54126'],
  ['#7662B1', '#A694DD'],
  ['#8A2EB8', '#B054DE'],
  ['#517A00', '#8FC426'],
  ['#000000', '#262626'],
  ['#3F6833', '#658E59'],
  ['#2F575E', '#557D84'],
  ['#99440A', '#BF6A30'],
  ['#AE561A', '#FF9B53'],
  ['#0E4AB4', '#3470DA'],
  ['#58140C', '#7E3A32'],
  ['#052B51', '#2B5177'],
  ['#511749', '#773D6F'],
  ['#3F2B5B', '#655181'],
] as const;

export function getTagColorIndexFromName(name = '', visualRefreshEnabled = false): number {
  const map = visualRefreshEnabled ? TAG_COLORS : TAG_COLORS_LEGACY;
  const hash = djb2(name.toLowerCase());
  return Math.abs(hash % map.length);
}

/**
 * Returns a dark and a light shade for the tag badge
 * These are used for the background and text color depending on the theme type (light or dark)
 * @param name tag name
 */
export function getTagColorsFromName(name = '', visualRefreshEnabled = false) {
  const index = getTagColorIndexFromName(name, visualRefreshEnabled);
  return getTagColor(index, visualRefreshEnabled);
}

export function getTagColor(index: number, visualRefreshEnabled = false) {
  const result = visualRefreshEnabled ? TAG_COLORS[index] : TAG_COLORS_LEGACY[index];

  // the old legacy return type was an object with color and borderColor properties
  // this maintains backwards runtime compatibility for a little bit
  // TODO remove in Grafana 14
  Object.assign(result, { color: result[0], borderColor: result[1] });

  return result;
}

function djb2(str: string) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash;
}
