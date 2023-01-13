import { ColorMap } from './types';

// Axis constants
export const INTERVAL_INDEX_LENGTH = 0.2;
export const LABEL_DISTANCE_FROM_GRID = 2;

// Scene constants
export const LABEL_INTERVAL = 5;
export const SCENE_SCALE = 100;
export const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

// Colors
export const BLACK = '#000000';
export const WHITE = 0xffffff;
export const AXIS_COLOR = 0x808080;
export const COLOR_PICKER_OPTIONS: ColorMap = {
  ['super-light-red']: '#FFA6B0',
  ['light-red']: '#FF7383',
  ['red']: '#F2495C',
  ['semi-dark-red']: '#E02F44',
  ['dark-red']: '#C4162A',
  ['super-light-orange']: '#FFCB7D',
  ['light-orange']: '#FFB357',
  ['orange']: '#FF9830',
  ['semi-dark-orange']: '#FF780A',
  ['dark-orange']: '#FA6400',
  ['super-light-yellow']: '#FFF899',
  ['light-yellow']: '#FFEE52',
  ['yellow']: '#FADE2A',
  ['semi-dark-yellow']: '#F2CC0C',
  ['dark-yellow']: '#E0B400',
  ['super-light-green']: '#C8F2C2',
  ['light-green']: '#96D98D',
  ['green']: '#73BF69',
  ['semi-dark-green']: '#56A64B',
  ['dark-green']: '#37872D',
  ['super-light-blue']: '#C0D8FF',
  ['light-blue']: '#8AB8FF',
  ['blue']: '#5794F2',
  ['semi-dark-blue']: '#3274D9',
  ['dark-blue']: '#1F60C4',
  ['super-light-purple']: '#DEB6F2',
  ['light-purple']: '#CA95E5',
  ['purple']: '#B877D9',
  ['semi-dark-purple']: '#A352CC',
  ['dark-purple']: '#8F3BB8',
};
