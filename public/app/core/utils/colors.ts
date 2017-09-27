import _ from 'lodash';

// Spectrum picker uses TinyColor and loads it as a global variable, so we can use it here also
declare var tinycolor;

const PALETTE_ROWS = 4;
const PALETTE_COLUMNS = 14;

let colors = [
  "#7EB26D","#EAB839","#6ED0E0","#EF843C","#E24D42","#1F78C1","#BA43A9","#705DA0",
  "#508642","#CCA300","#447EBC","#C15C17","#890F02","#0A437C","#6D1F62","#584477",
  "#B7DBAB","#F4D598","#70DBED","#F9BA8F","#F29191","#82B5D8","#E5A8E2","#AEA2E0",
  "#629E51","#E5AC0E","#64B0C8","#E0752D","#BF1B00","#0A50A1","#962D82","#614D93",
  "#9AC48A","#F2C96D","#65C5DB","#F9934E","#EA6460","#5195CE","#D683CE","#806EB7",
  "#3F6833","#967302","#2F575E","#99440A","#58140C","#052B51","#511749","#3F2B5B",
  "#E0F9D7","#FCEACA","#CFFAFF","#F9E2D2","#FCE2DE","#BADFF4","#F9D9F9","#DEDAF7"
];

export function sortColorsByHue(hexColors) {
  let hslColors = _.map(hexColors, hexToHsl);

  let sortedHSLColors = _.sortBy(hslColors, ['h']);
  sortedHSLColors = _.chunk(sortedHSLColors, PALETTE_ROWS);
  sortedHSLColors = _.map(sortedHSLColors, chunk => {
    return _.sortBy(chunk, 'l');
  });
  sortedHSLColors = _.flattenDeep(_.zip(...sortedHSLColors));

  return _.map(sortedHSLColors, hslToHex);
}

export function hexToHsl(color) {
  return tinycolor(color).toHsl();
}

export function hslToHex(color) {
  return tinycolor(color).toHexString();
}

export let sortedColors = sortColorsByHue(colors);
export default colors;
