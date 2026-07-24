import { map, sortBy, flattenDeep, chunk, zip } from 'lodash';
import tinycolor from 'tinycolor2';

const PALETTE_ROWS = 4;

/**
 * @alpha
 */
export const DEFAULT_ANNOTATION_COLOR = 'rgba(0, 211, 255, 1)';

/**
 * @alpha
 */
export const OK_COLOR = 'rgba(11, 237, 50, 1)';

/**
 * @alpha
 */
export const ALERTING_COLOR = 'rgba(237, 46, 24, 1)';

/**
 * @alpha
 */
export const NO_DATA_COLOR = 'rgba(150, 150, 150, 1)';

/**
 * @alpha
 */
export const PENDING_COLOR = 'rgba(247, 149, 32, 1)';

/**
 * @alpha
 */
export const REGION_FILL_ALPHA = 0.09;
export const colors = [
  '#7EB26D', // 0: pale green
  '#EAB839', // 1: mustard
  '#6ED0E0', // 2: light blue
  '#EF843C', // 3: orange
  '#E24D42', // 4: red
  '#1F78C1', // 5: ocean
  '#BA43A9', // 6: purple
  '#705DA0', // 7: violet
  '#508642', // 8: dark green
  '#CCA300', // 9: dark sand
  '#447EBC',
  '#C15C17',
  '#890F02',
  '#0A437C',
  '#6D1F62',
  '#584477',
  '#B7DBAB',
  '#F4D598',
  '#70DBED',
  '#F9BA8F',
  '#F29191',
  '#82B5D8',
  '#E5A8E2',
  '#AEA2E0',
  '#629E51',
  '#E5AC0E',
  '#64B0C8',
  '#E0752D',
  '#BF1B00',
  '#0A50A1',
  '#962D82',
  '#614D93',
  '#9AC48A',
  '#F2C96D',
  '#65C5DB',
  '#F9934E',
  '#EA6460',
  '#5195CE',
  '#D683CE',
  '#806EB7',
  '#3F6833',
  '#967302',
  '#2F575E',
  '#99440A',
  '#58140C',
  '#052B51',
  '#511749',
  '#3F2B5B',
  '#E0F9D7',
  '#FCEACA',
  '#CFFAFF',
  '#F9E2D2',
  '#FCE2DE',
  '#BADFF4',
  '#F9D9F9',
  '#DEDAF7',
];

function sortColorsByHue(hexColors: string[]) {
  const hslColors = map(hexColors, hexToHsl);

  const sortedHSLColors = sortBy(hslColors, ['h']);
  const chunkedHSLColors = chunk(sortedHSLColors, PALETTE_ROWS);
  const sortedChunkedHSLColors = map(chunkedHSLColors, (chunk) => {
    return sortBy(chunk, 'l');
  });
  const flattenedZippedSortedChunkedHSLColors = flattenDeep(zip(...sortedChunkedHSLColors));

  return map(flattenedZippedSortedChunkedHSLColors, hslToHex);
}

function hexToHsl(color: string) {
  return tinycolor(color).toHsl();
}

function hslToHex(color: tinycolor.ColorFormats.HSLA) {
  return tinycolor(color).toHexString();
}

export function getTextColorForBackground(color: string) {
  const b = tinycolor(color).getBrightness();

  return b > 180 ? 'rgb(32, 34, 38)' : 'rgb(247, 248, 250)';
}

export function getTextColorForAlphaBackground(color: string, themeIsDark: boolean) {
  const tcolor = tinycolor(color);
  const b = tcolor.getBrightness();
  const a = tcolor.getAlpha();

  if (a < 0.3) {
    return themeIsDark ? 'rgb(247, 248, 250)' : 'rgb(32, 34, 38)';
  }

  return b > 180 ? 'rgb(32, 34, 38)' : 'rgb(247, 248, 250)';
}

export let sortedColors = sortColorsByHue(colors);
