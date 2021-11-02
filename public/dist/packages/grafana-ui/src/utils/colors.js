import { __read, __spreadArray } from "tslib";
import { map, sortBy, flattenDeep, chunk, zip } from 'lodash';
import tinycolor from 'tinycolor2';
var PALETTE_ROWS = 4;
/**
 * @alpha
 */
export var DEFAULT_ANNOTATION_COLOR = 'rgba(0, 211, 255, 1)';
/**
 * @alpha
 */
export var OK_COLOR = 'rgba(11, 237, 50, 1)';
/**
 * @alpha
 */
export var ALERTING_COLOR = 'rgba(237, 46, 24, 1)';
/**
 * @alpha
 */
export var NO_DATA_COLOR = 'rgba(150, 150, 150, 1)';
/**
 * @alpha
 */
export var PENDING_COLOR = 'rgba(247, 149, 32, 1)';
/**
 * @alpha
 */
export var REGION_FILL_ALPHA = 0.09;
export var colors = [
    '#7EB26D',
    '#EAB839',
    '#6ED0E0',
    '#EF843C',
    '#E24D42',
    '#1F78C1',
    '#BA43A9',
    '#705DA0',
    '#508642',
    '#CCA300',
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
function sortColorsByHue(hexColors) {
    var hslColors = map(hexColors, hexToHsl);
    var sortedHSLColors = sortBy(hslColors, ['h']);
    var chunkedHSLColors = chunk(sortedHSLColors, PALETTE_ROWS);
    var sortedChunkedHSLColors = map(chunkedHSLColors, function (chunk) {
        return sortBy(chunk, 'l');
    });
    var flattenedZippedSortedChunkedHSLColors = flattenDeep(zip.apply(void 0, __spreadArray([], __read(sortedChunkedHSLColors), false)));
    return map(flattenedZippedSortedChunkedHSLColors, hslToHex);
}
function hexToHsl(color) {
    return tinycolor(color).toHsl();
}
function hslToHex(color) {
    return tinycolor(color).toHexString();
}
export function getTextColorForBackground(color) {
    var b = tinycolor(color).getBrightness();
    return b > 180 ? 'rgb(32, 34, 38)' : 'rgb(247, 248, 250)';
}
export var sortedColors = sortColorsByHue(colors);
//# sourceMappingURL=colors.js.map