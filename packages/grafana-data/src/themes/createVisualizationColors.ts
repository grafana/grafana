import { FALLBACK_COLOR } from '../types/fieldColor';

import { ThemeColors } from './createColors';

/**
 * @alpha
 */
export interface ThemeVisualizationColors {
  /** Only for internal use by color schemes */
  palette: string[];
  /** Lookup the real color given the name */
  getColorByName: (color: string) => string;
  /** Colors organized by hue */
  hues: ThemeVizHue[];
}

/**
 * @alpha
 */
export interface ThemeVizColor<T extends ThemeVizColorName> {
  color: string;
  name: ThemeVizColorShadeName<T>;
  aliases?: string[];
  primary?: boolean;
}

type ThemeVizColorName = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';

type ThemeVizColorShadeName<T extends ThemeVizColorName> =
  | `super-light-${T}`
  | `light-${T}`
  | T
  | `semi-dark-${T}`
  | `dark-${T}`;

type ThemeVizHueGeneric<T> = T extends ThemeVizColorName
  ? {
      name: T;
      shades: Array<ThemeVizColor<T>>;
    }
  : never;

/**
 * @alpha
 */
export type ThemeVizHue = ThemeVizHueGeneric<ThemeVizColorName>;

export type ThemeVisualizationColorsInput = {
  hues?: ThemeVizHue[];
  palette?: string[];
};

/**
 * @internal
 */
export function createVisualizationColors(
  colors: ThemeColors,
  options: ThemeVisualizationColorsInput = {}
): ThemeVisualizationColors {
  const baseHues = colors.mode === 'light' ? getLightHues() : getDarkHues();
  const { palette = getClassicPalette(), hues: hueOverrides = [] } = options;

  const hues = [...baseHues];
  // override hues with user provided
  for (const hueOverride of hueOverrides) {
    const existingHue = hues.find((hue) => hue.name === hueOverride.name);
    if (existingHue) {
      for (const shadeOverride of hueOverride.shades) {
        const existingShade = existingHue.shades.find((shade) => shade.name === shadeOverride.name);
        if (existingShade) {
          existingShade.color = shadeOverride.color;
        }
      }
    }
  }

  const byNameIndex: Record<string, string> = {};

  for (const hue of hues) {
    for (const shade of hue.shades) {
      byNameIndex[shade.name] = shade.color;
      if (shade.aliases) {
        for (const alias of shade.aliases) {
          byNameIndex[alias] = shade.color;
        }
      }
    }
  }

  // special colors
  byNameIndex['transparent'] = colors.mode === 'light' ? 'rgba(255, 255, 255, 0)' : 'rgba(0,0,0,0)';
  byNameIndex['panel-bg'] = colors.background.primary;
  byNameIndex['text'] = colors.text.primary;

  const getColorByName = (colorName: string) => {
    if (!colorName) {
      return FALLBACK_COLOR;
    }

    const realColor = byNameIndex[colorName];
    if (realColor) {
      return realColor;
    }

    if (colorName[0] === '#') {
      return colorName;
    }

    if (colorName.indexOf('rgb') > -1) {
      return colorName;
    }

    const nativeColor = nativeColorNames[colorName.toLowerCase()];
    if (nativeColor) {
      byNameIndex[colorName] = nativeColor;
      return nativeColor;
    }

    return colorName;
  };

  return {
    hues,
    palette,
    getColorByName,
  };
}

function getDarkHues(): ThemeVizHue[] {
  return [
    {
      name: 'red',
      shades: [
        { color: '#FFA6B0', name: 'super-light-red' },
        { color: '#FF7383', name: 'light-red' },
        { color: '#F2495C', name: 'red', primary: true },
        { color: '#E02F44', name: 'semi-dark-red' },
        { color: '#C4162A', name: 'dark-red' },
      ],
    },
    {
      name: 'orange',
      shades: [
        { color: '#FFCB7D', name: 'super-light-orange', aliases: [] },
        { color: '#FFB357', name: 'light-orange', aliases: [] },
        { color: '#FF9830', name: 'orange', aliases: [], primary: true },
        { color: '#FF780A', name: 'semi-dark-orange', aliases: [] },
        { color: '#FA6400', name: 'dark-orange', aliases: [] },
      ],
    },
    {
      name: 'yellow',
      shades: [
        { color: '#FFF899', name: 'super-light-yellow', aliases: [] },
        { color: '#FFEE52', name: 'light-yellow', aliases: [] },
        { color: '#FADE2A', name: 'yellow', aliases: [], primary: true },
        { color: '#F2CC0C', name: 'semi-dark-yellow', aliases: [] },
        { color: '#E0B400', name: 'dark-yellow', aliases: [] },
      ],
    },
    {
      name: 'green',
      shades: [
        { color: '#C8F2C2', name: 'super-light-green', aliases: [] },
        { color: '#96D98D', name: 'light-green', aliases: [] },
        { color: '#73BF69', name: 'green', aliases: [], primary: true },
        { color: '#56A64B', name: 'semi-dark-green', aliases: [] },
        { color: '#37872D', name: 'dark-green', aliases: [] },
      ],
    },
    {
      name: 'blue',
      shades: [
        { color: '#C0D8FF', name: 'super-light-blue', aliases: [] },
        { color: '#8AB8FF', name: 'light-blue', aliases: [] },
        { color: '#5794F2', name: 'blue', aliases: [], primary: true },
        { color: '#3274D9', name: 'semi-dark-blue', aliases: [] },
        { color: '#1F60C4', name: 'dark-blue', aliases: [] },
      ],
    },
    {
      name: 'purple',
      shades: [
        { color: '#DEB6F2', name: 'super-light-purple', aliases: [] },
        { color: '#CA95E5', name: 'light-purple', aliases: [] },
        { color: '#B877D9', name: 'purple', aliases: [], primary: true },
        { color: '#A352CC', name: 'semi-dark-purple', aliases: [] },
        { color: '#8F3BB8', name: 'dark-purple', aliases: [] },
      ],
    },
  ];
}

function getLightHues(): ThemeVizHue[] {
  return [
    {
      name: 'red',
      shades: [
        { color: '#FF7383', name: 'super-light-red' },
        { color: '#F2495C', name: 'light-red' },
        { color: '#E02F44', name: 'red', primary: true },
        { color: '#C4162A', name: 'semi-dark-red' },
        { color: '#AD0317', name: 'dark-red' },
      ],
    },
    {
      name: 'orange',
      shades: [
        { color: '#FFB357', name: 'super-light-orange', aliases: [] },
        { color: '#FF9830', name: 'light-orange', aliases: [] },
        { color: '#FF780A', name: 'orange', aliases: [], primary: true },
        { color: '#FA6400', name: 'semi-dark-orange', aliases: [] },
        { color: '#E55400', name: 'dark-orange', aliases: [] },
      ],
    },
    {
      name: 'yellow',
      shades: [
        { color: '#FFEE52', name: 'super-light-yellow', aliases: [] },
        { color: '#FADE2A', name: 'light-yellow', aliases: [] },
        { color: '#F2CC0C', name: 'yellow', aliases: [], primary: true },
        { color: '#E0B400', name: 'semi-dark-yellow', aliases: [] },
        { color: '#CC9D00', name: 'dark-yellow', aliases: [] },
      ],
    },
    {
      name: 'green',
      shades: [
        { color: '#96D98D', name: 'super-light-green', aliases: [] },
        { color: '#73BF69', name: 'light-green', aliases: [] },
        { color: '#56A64B', name: 'green', aliases: [], primary: true },
        { color: '#37872D', name: 'semi-dark-green', aliases: [] },
        { color: '#19730E', name: 'dark-green', aliases: [] },
      ],
    },
    {
      name: 'blue',
      shades: [
        { color: '#8AB8FF', name: 'super-light-blue', aliases: [] },
        { color: '#5794F2', name: 'light-blue', aliases: [] },
        { color: '#3274D9', name: 'blue', aliases: [], primary: true },
        { color: '#1F60C4', name: 'semi-dark-blue', aliases: [] },
        { color: '#1250B0', name: 'dark-blue', aliases: [] },
      ],
    },
    {
      name: 'purple',
      shades: [
        { color: '#CA95E5', name: 'super-light-purple', aliases: [] },
        { color: '#B877D9', name: 'light-purple', aliases: [] },
        { color: '#A352CC', name: 'purple', aliases: [], primary: true },
        { color: '#8F3BB8', name: 'semi-dark-purple', aliases: [] },
        { color: '#7C2EA3', name: 'dark-purple', aliases: [] },
      ],
    },
  ];
}

function getClassicPalette() {
  // Todo replace these with named colors (as many as possible)

  return [
    'green',
    'yellow',
    'blue',
    'orange',
    'red',
    'purple',
    'dark-green',
    'dark-yellow',
    'dark-blue',
    'dark-orange',
    'dark-red',
    'dark-purple',
    'super-light-green',
    'super-light-yellow',
    'super-light-blue',
    'super-light-orange',
    'super-light-red',
    'super-light-purple',
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
}

// Old hues
// function getDarkHues(): ThemeVizHue[] {
//     return [
//       {
//         name: 'red',
//         shades: [
//           { name: 'red1', color: '#FFC2D4', aliases: ['super-light-red'] },
//           { name: 'red2', color: '#FFA8C2', aliases: ['light-red'] },
//           { name: 'red3', color: '#FF85A9', aliases: ['red'], primary: true },
//           { name: 'red4', color: '#FF5286', aliases: ['semi-dark-red'] },
//           { name: 'red5', color: '#E0226E', aliases: ['dark-red'] },
//         ],
//       },
//       {
//         name: 'orange',
//         shades: [
//           { name: 'orange1', color: '#FFC0AD', aliases: ['super-light-orange'] },
//           { name: 'orange2', color: '#FFA98F', aliases: ['light-orange'] },
//           { name: 'orange3', color: '#FF825C', aliases: ['orange'], primary: true },
//           { name: 'orange4', color: '#FF5F2E', aliases: ['semi-dark-orange'] },
//           { name: 'orange5', color: '#E73903', aliases: ['dark-orange'] },
//         ],
//       },
//       {
//         name: 'yellow',
//         shades: [
//           { name: 'yellow1', color: '#FFE68F', aliases: ['super-light-yellow'] },
//           { name: 'yellow2', color: '#FAD34A', aliases: ['light-yellow'] },
//           { name: 'yellow3', color: '#ECBB09', aliases: ['yellow'], primary: true },
//           { name: 'yellow4', color: '#CFA302', aliases: ['semi-dark-yellow'] },
//           { name: 'yellow5', color: '#AD8800', aliases: ['dark-yellow'] },
//         ],
//       },
//       {
//         name: 'green',
//         shades: [
//           { name: 'green1', color: '#93ECCB', aliases: ['super-light-green'] },
//           { name: 'green2', color: '#65DCB1', aliases: ['light-green'] },
//           { name: 'green3', color: '#2DC88F', aliases: ['green'], primary: true },
//           { name: 'green4', color: '#25A777', aliases: ['semi-dark-green'] },
//           { name: 'green5', color: '#1B855E', aliases: ['dark-green'] },
//         ],
//       },
//       {
//         name: 'teal',
//         shades: [
//           { name: 'teal1', color: '#73E7F7' },
//           { name: 'teal2', color: '#2BD6EE' },
//           { name: 'teal3', color: '#11BDD4', primary: true },
//           { name: 'teal4', color: '#0EA0B4' },
//           { name: 'teal5', color: '#077D8D' },
//         ],
//       },
//       {
//         name: 'blue',
//         shades: [
//           { name: 'blue1', color: '#C2D7FF', aliases: ['super-light-blue'] },
//           { name: 'blue2', color: '#A3C2FF', aliases: ['light-blue'] },
//           { name: 'blue3', color: '#83ACFC', aliases: ['blue'], primary: true },
//           { name: 'blue4', color: '#5D8FEF', aliases: ['semi-dark-blue'] },
//           { name: 'blue5', color: '#3871DC', aliases: ['dark-blue'] },
//         ],
//       },
//       {
//         name: 'violet',
//         shades: [
//           { name: 'violet1', color: '#DACCFF' },
//           { name: 'violet2', color: '#C7B2FF' },
//           { name: 'violet3', color: '#B094FF', primary: true },
//           { name: 'violet4', color: '#9271EF' },
//           { name: 'violet5', color: '#7E63CA' },
//         ],
//       },
//       {
//         name: 'purple',
//         shades: [
//           { name: 'purple1', color: '#FFBDFF', aliases: ['super-light-purple'] },
//           { name: 'purple2', color: '#F5A3F5', aliases: ['light-purple'] },
//           { name: 'purple3', color: '#E48BE4', aliases: ['purple'], primary: true },
//           { name: 'purple4', color: '#CA68CA', aliases: ['semi-dark-purple'] },
//           { name: 'purple5', color: '#B545B5', aliases: ['dark-purple'] },
//         ],
//       },
//     ];
//   }

const nativeColorNames: Record<string, string> = {
  aliceblue: '#f0f8ff',
  antiquewhite: '#faebd7',
  aqua: '#00ffff',
  aquamarine: '#7fffd4',
  azure: '#f0ffff',
  beige: '#f5f5dc',
  bisque: '#ffe4c4',
  black: '#000000',
  blanchedalmond: '#ffebcd',
  blue: '#0000ff',
  blueviolet: '#8a2be2',
  brown: '#a52a2a',
  burlywood: '#deb887',
  cadetblue: '#5f9ea0',
  chartreuse: '#7fff00',
  chocolate: '#d2691e',
  coral: '#ff7f50',
  cornflowerblue: '#6495ed',
  cornsilk: '#fff8dc',
  crimson: '#dc143c',
  cyan: '#00ffff',
  darkblue: '#00008b',
  darkcyan: '#008b8b',
  darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9',
  darkgreen: '#006400',
  darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b',
  darkolivegreen: '#556b2f',
  darkorange: '#ff8c00',
  darkorchid: '#9932cc',
  darkred: '#8b0000',
  darksalmon: '#e9967a',
  darkseagreen: '#8fbc8f',
  darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f',
  darkturquoise: '#00ced1',
  darkviolet: '#9400d3',
  deeppink: '#ff1493',
  deepskyblue: '#00bfff',
  dimgray: '#696969',
  dodgerblue: '#1e90ff',
  firebrick: '#b22222',
  floralwhite: '#fffaf0',
  forestgreen: '#228b22',
  fuchsia: '#ff00ff',
  gainsboro: '#dcdcdc',
  ghostwhite: '#f8f8ff',
  gold: '#ffd700',
  goldenrod: '#daa520',
  gray: '#808080',
  green: '#008000',
  greenyellow: '#adff2f',
  honeydew: '#f0fff0',
  hotpink: '#ff69b4',
  'indianred ': '#cd5c5c',
  indigo: '#4b0082',
  ivory: '#fffff0',
  khaki: '#f0e68c',
  lavender: '#e6e6fa',
  lavenderblush: '#fff0f5',
  lawngreen: '#7cfc00',
  lemonchiffon: '#fffacd',
  lightblue: '#add8e6',
  lightcoral: '#f08080',
  lightcyan: '#e0ffff',
  lightgoldenrodyellow: '#fafad2',
  lightgrey: '#d3d3d3',
  lightgreen: '#90ee90',
  lightpink: '#ffb6c1',
  lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa',
  lightskyblue: '#87cefa',
  lightslategray: '#778899',
  lightsteelblue: '#b0c4de',
  lightyellow: '#ffffe0',
  lime: '#00ff00',
  limegreen: '#32cd32',
  linen: '#faf0e6',
  magenta: '#ff00ff',
  maroon: '#800000',
  mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd',
  mediumorchid: '#ba55d3',
  mediumpurple: '#9370d8',
  mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a',
  mediumturquoise: '#48d1cc',
  mediumvioletred: '#c71585',
  midnightblue: '#191970',
  mintcream: '#f5fffa',
  mistyrose: '#ffe4e1',
  moccasin: '#ffe4b5',
  navajowhite: '#ffdead',
  navy: '#000080',
  oldlace: '#fdf5e6',
  olive: '#808000',
  olivedrab: '#6b8e23',
  orange: '#ffa500',
  orangered: '#ff4500',
  orchid: '#da70d6',
  palegoldenrod: '#eee8aa',
  palegreen: '#98fb98',
  paleturquoise: '#afeeee',
  palevioletred: '#d87093',
  papayawhip: '#ffefd5',
  peachpuff: '#ffdab9',
  peru: '#cd853f',
  pink: '#ffc0cb',
  plum: '#dda0dd',
  powderblue: '#b0e0e6',
  purple: '#800080',
  rebeccapurple: '#663399',
  red: '#ff0000',
  rosybrown: '#bc8f8f',
  royalblue: '#4169e1',
  saddlebrown: '#8b4513',
  salmon: '#fa8072',
  sandybrown: '#f4a460',
  seagreen: '#2e8b57',
  seashell: '#fff5ee',
  sienna: '#a0522d',
  silver: '#c0c0c0',
  skyblue: '#87ceeb',
  slateblue: '#6a5acd',
  slategray: '#708090',
  snow: '#fffafa',
  springgreen: '#00ff7f',
  steelblue: '#4682b4',
  tan: '#d2b48c',
  teal: '#008080',
  thistle: '#d8bfd8',
  tomato: '#ff6347',
  turquoise: '#40e0d0',
  violet: '#ee82ee',
  wheat: '#f5deb3',
  white: '#ffffff',
  whitesmoke: '#f5f5f5',
  yellow: '#ffff00',
  yellowgreen: '#9acd32',
};
