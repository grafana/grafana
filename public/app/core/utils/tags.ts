const TAG_COLORS = [
  '#E24D42',
  '#1F78C1',
  '#BA43A9',
  '#705DA0',
  '#466803',
  '#508642',
  '#447EBC',
  '#C15C17',
  '#890F02',
  '#757575',
  '#0A437C',
  '#6D1F62',
  '#584477',
  '#629E51',
  '#2F4F4F',
  '#BF1B00',
  '#806EB7',
  '#8a2eb8',
  '#699e00',
  '#000000',
  '#3F6833',
  '#2F575E',
  '#99440A',
  '#E0752D',
  '#0E4AB4',
  '#58140C',
  '#052B51',
  '#511749',
  '#3F2B5B',
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

/**
 * Returns tag badge background and border colors based on hashed tag name.
 * @param name tag name
 */
export function getTagColorsFromName(name: string): { color: string; borderColor: string } {
  let hash = djb2(name.toLowerCase());
  let color = TAG_COLORS[Math.abs(hash % TAG_COLORS.length)];
  let borderColor = TAG_BORDER_COLORS[Math.abs(hash % TAG_BORDER_COLORS.length)];
  return { color, borderColor };
}

function djb2(str) {
  let hash = 5381;
  for (var i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash;
}

export default {
  getTagColorsFromName,
};
