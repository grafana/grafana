import flatten from 'lodash/flatten';
import tinycolor from 'tinycolor2';
import { GrafanaTheme, GrafanaThemeType } from '../types/theme';

type Hue = 'green' | 'yellow' | 'red' | 'blue' | 'orange' | 'purple';

export type Color =
  | 'green'
  | 'dark-green'
  | 'semi-dark-green'
  | 'light-green'
  | 'super-light-green'
  | 'yellow'
  | 'dark-yellow'
  | 'semi-dark-yellow'
  | 'light-yellow'
  | 'super-light-yellow'
  | 'red'
  | 'dark-red'
  | 'semi-dark-red'
  | 'light-red'
  | 'super-light-red'
  | 'blue'
  | 'dark-blue'
  | 'semi-dark-blue'
  | 'light-blue'
  | 'super-light-blue'
  | 'orange'
  | 'dark-orange'
  | 'semi-dark-orange'
  | 'light-orange'
  | 'super-light-orange'
  | 'purple'
  | 'dark-purple'
  | 'semi-dark-purple'
  | 'light-purple'
  | 'super-light-purple'
  | 'panel-bg';

type ThemeVariants = {
  dark: string;
  light: string;
};

export type ColorDefinition = {
  hue: Hue;
  isPrimary?: boolean;
  name: Color;
  variants: ThemeVariants;
};

let colorsPaletteInstance: Map<Hue, ColorDefinition[]>;
let colorsMap: Record<Color, string> | undefined;
let colorsMapTheme: GrafanaTheme | undefined;

const buildColorDefinition = (
  hue: Hue,
  name: Color,
  [light, dark]: string[],
  isPrimary?: boolean
): ColorDefinition => ({
  hue,
  name,
  variants: {
    light,
    dark,
  },
  isPrimary: !!isPrimary,
});

export function getColorDefinitionByName(name: Color): ColorDefinition {
  return flatten(Array.from(getNamedColorPalette().values())).filter(definition => definition.name === name)[0];
}

export function buildColorsMapForTheme(theme: GrafanaTheme): Record<Color, string> {
  theme = theme ?? GrafanaThemeType.Dark;

  colorsMap = {} as Record<Color, string>;

  for (const def of getNamedColorPalette().values()) {
    for (const c of def) {
      colorsMap[c.name] = c.variants[theme.type];
    }
  }

  colorsMap['panel-bg'] = theme.colors.panelBg;

  return colorsMap;
}

export function getColorForTheme(color: string, theme: GrafanaTheme): string {
  if (!color) {
    return 'gray';
  }

  // check if we need to rebuild cache
  if (!colorsMap || colorsMapTheme !== theme) {
    colorsMap = buildColorsMapForTheme(theme);
    colorsMapTheme = theme;
  }

  let realColor = colorsMap[color as Color];
  if (realColor) {
    return realColor;
  }

  if (color[0] === '#') {
    return (colorsMap[color as Color] = color);
  }

  if (color.indexOf('rgb') > -1) {
    return (colorsMap[color as Color] = color);
  }

  return (colorsMap[color as Color] = tinycolor(color).toHexString());
}

/**
 * @deprecated use getColorForTheme
 */
export function getColorFromHexRgbOrName(color: string, type?: GrafanaThemeType): string {
  const themeType = type ?? GrafanaThemeType.Dark;

  if (themeType === GrafanaThemeType.Dark) {
    const darkTheme = ({
      type: themeType,
      colors: {
        panelBg: '#141619',
      },
    } as unknown) as GrafanaTheme;

    return getColorForTheme(color, darkTheme);
  }

  const lightTheme = ({
    type: themeType,
    colors: {
      panelBg: '#000000',
    },
  } as unknown) as GrafanaTheme;

  return getColorForTheme(color, lightTheme);
}

const buildNamedColorsPalette = () => {
  const palette = new Map<Hue, ColorDefinition[]>();

  const BasicGreen = buildColorDefinition('green', 'green', ['#56A64B', '#73BF69'], true);
  const DarkGreen = buildColorDefinition('green', 'dark-green', ['#19730E', '#37872D']);
  const SemiDarkGreen = buildColorDefinition('green', 'semi-dark-green', ['#37872D', '#56A64B']);
  const LightGreen = buildColorDefinition('green', 'light-green', ['#73BF69', '#96D98D']);
  const SuperLightGreen = buildColorDefinition('green', 'super-light-green', ['#96D98D', '#C8F2C2']);

  const BasicYellow = buildColorDefinition('yellow', 'yellow', ['#F2CC0C', '#FADE2A'], true);
  const DarkYellow = buildColorDefinition('yellow', 'dark-yellow', ['#CC9D00', '#E0B400']);
  const SemiDarkYellow = buildColorDefinition('yellow', 'semi-dark-yellow', ['#E0B400', '#F2CC0C']);
  const LightYellow = buildColorDefinition('yellow', 'light-yellow', ['#FADE2A', '#FFEE52']);
  const SuperLightYellow = buildColorDefinition('yellow', 'super-light-yellow', ['#FFEE52', '#FFF899']);

  const BasicRed = buildColorDefinition('red', 'red', ['#E02F44', '#F2495C'], true);
  const DarkRed = buildColorDefinition('red', 'dark-red', ['#AD0317', '#C4162A']);
  const SemiDarkRed = buildColorDefinition('red', 'semi-dark-red', ['#C4162A', '#E02F44']);
  const LightRed = buildColorDefinition('red', 'light-red', ['#F2495C', '#FF7383']);
  const SuperLightRed = buildColorDefinition('red', 'super-light-red', ['#FF7383', '#FFA6B0']);

  const BasicBlue = buildColorDefinition('blue', 'blue', ['#3274D9', '#5794F2'], true);
  const DarkBlue = buildColorDefinition('blue', 'dark-blue', ['#1250B0', '#1F60C4']);
  const SemiDarkBlue = buildColorDefinition('blue', 'semi-dark-blue', ['#1F60C4', '#3274D9']);
  const LightBlue = buildColorDefinition('blue', 'light-blue', ['#5794F2', '#8AB8FF']);
  const SuperLightBlue = buildColorDefinition('blue', 'super-light-blue', ['#8AB8FF', '#C0D8FF']);

  const BasicOrange = buildColorDefinition('orange', 'orange', ['#FF780A', '#FF9830'], true);
  const DarkOrange = buildColorDefinition('orange', 'dark-orange', ['#E55400', '#FA6400']);
  const SemiDarkOrange = buildColorDefinition('orange', 'semi-dark-orange', ['#FA6400', '#FF780A']);
  const LightOrange = buildColorDefinition('orange', 'light-orange', ['#FF9830', '#FFB357']);
  const SuperLightOrange = buildColorDefinition('orange', 'super-light-orange', ['#FFB357', '#FFCB7D']);

  const BasicPurple = buildColorDefinition('purple', 'purple', ['#A352CC', '#B877D9'], true);
  const DarkPurple = buildColorDefinition('purple', 'dark-purple', ['#7C2EA3', '#8F3BB8']);
  const SemiDarkPurple = buildColorDefinition('purple', 'semi-dark-purple', ['#8F3BB8', '#A352CC']);
  const LightPurple = buildColorDefinition('purple', 'light-purple', ['#B877D9', '#CA95E5']);
  const SuperLightPurple = buildColorDefinition('purple', 'super-light-purple', ['#CA95E5', '#DEB6F2']);

  const greens = [BasicGreen, DarkGreen, SemiDarkGreen, LightGreen, SuperLightGreen];
  const yellows = [BasicYellow, DarkYellow, SemiDarkYellow, LightYellow, SuperLightYellow];
  const reds = [BasicRed, DarkRed, SemiDarkRed, LightRed, SuperLightRed];
  const blues = [BasicBlue, DarkBlue, SemiDarkBlue, LightBlue, SuperLightBlue];
  const oranges = [BasicOrange, DarkOrange, SemiDarkOrange, LightOrange, SuperLightOrange];
  const purples = [BasicPurple, DarkPurple, SemiDarkPurple, LightPurple, SuperLightPurple];

  palette.set('green', greens);
  palette.set('yellow', yellows);
  palette.set('red', reds);
  palette.set('blue', blues);
  palette.set('orange', oranges);
  palette.set('purple', purples);

  return palette;
};

export const getNamedColorPalette = () => {
  if (colorsPaletteInstance) {
    return colorsPaletteInstance;
  }

  colorsPaletteInstance = buildNamedColorsPalette();
  return colorsPaletteInstance;
};

export const classicColors = [
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
