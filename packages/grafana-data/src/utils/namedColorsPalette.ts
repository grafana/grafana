import flatten from 'lodash/flatten';
import tinycolor from 'tinycolor2';
import { GrafanaThemeType } from '../types/theme';

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
  | 'super-light-purple';

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

export const getColorDefinitionByName = (name: Color): ColorDefinition => {
  return flatten(Array.from(getNamedColorPalette().values())).filter(definition => definition.name === name)[0];
};

export const getColorDefinition = (hex: string, theme: GrafanaThemeType): ColorDefinition | undefined => {
  return flatten(Array.from(getNamedColorPalette().values())).filter(
    definition => definition.variants[theme] === hex
  )[0];
};

const isHex = (color: string) => {
  const hexRegex = /^((0x){0,1}|#{0,1})([0-9A-F]{8}|[0-9A-F]{6}|[0-9A-F]{3})$/gi;
  return hexRegex.test(color);
};

export const getColorName = (color?: string, theme?: GrafanaThemeType): Color | undefined => {
  if (!color) {
    return undefined;
  }

  if (color.indexOf('rgb') > -1) {
    return undefined;
  }
  if (isHex(color)) {
    const definition = getColorDefinition(color, theme || GrafanaThemeType.Dark);
    return definition ? definition.name : undefined;
  }

  return color as Color;
};

export const getColorByName = (colorName: string) => {
  const definition = flatten(Array.from(getNamedColorPalette().values())).filter(
    definition => definition.name === colorName
  );
  return definition.length > 0 ? definition[0] : undefined;
};

export const getColorFromHexRgbOrName = (color: string, theme?: GrafanaThemeType): string => {
  if (color.indexOf('rgb') > -1 || isHex(color)) {
    return color;
  }

  const colorDefinition = getColorByName(color);

  if (!colorDefinition) {
    return new tinycolor(color).toHexString();
  }

  return theme ? colorDefinition.variants[theme] : colorDefinition.variants.dark;
};

export const getColorForTheme = (color: ColorDefinition, theme?: GrafanaThemeType) => {
  return theme ? color.variants[theme] : color.variants.dark;
};

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
