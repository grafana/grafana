import { flatten } from 'lodash';
import { GrafanaTheme } from '../types';

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

export const ColorsPalette = new Map<Hue, ColorDefinition[]>();

export const buildColorDefinition = (
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

export const BasicGreen = buildColorDefinition('green', 'green', ['#56A64B', '#73BF69'], true);
export const DarkGreen = buildColorDefinition('green', 'dark-green', ['#19730E', '#37872D']);
export const SemiDarkGreen = buildColorDefinition('green', 'semi-dark-green', ['#37872D', '#56A64B']);
export const LightGreen = buildColorDefinition('green', 'light-green', ['#73BF69', '#96D98D']);
export const SuperLightGreen = buildColorDefinition('green', 'super-light-green', ['#96D98D', '#C8F2C2']);

export const BasicYellow = buildColorDefinition('yellow', 'yellow', ['#F2CC0C', '#FADE2A'], true);
export const DarkYellow = buildColorDefinition('yellow', 'dark-yellow', ['#CC9D00', '#E0B400']);
export const SemiDarkYellow = buildColorDefinition('yellow', 'semi-dark-yellow', ['#E0B400', '#F2CC0C']);
export const LightYellow = buildColorDefinition('yellow', 'light-yellow', ['#FADE2A', '#FFEE52']);
export const SuperLightYellow = buildColorDefinition('yellow', 'super-light-yellow', ['#FFEE52', '#FFF899']);

export const BasicRed = buildColorDefinition('red', 'red', ['#E02F44', '#F2495C'], true);
export const DarkRed = buildColorDefinition('red', 'dark-red', ['#AD0317', '#C4162A']);
export const SemiDarkRed = buildColorDefinition('red', 'semi-dark-red', ['#C4162A', '#E02F44']);
export const LightRed = buildColorDefinition('red', 'light-red', ['#F2495C', '#FF7383']);
export const SuperLightRed = buildColorDefinition('red', 'super-light-red', ['#FF7383', '#FFA6B0']);

export const BasicBlue = buildColorDefinition('blue', 'blue', ['#3274D9', '#5794F2'], true);
export const DarkBlue = buildColorDefinition('blue', 'dark-blue', ['#1250B0', '#1F60C4']);
export const SemiDarkBlue = buildColorDefinition('blue', 'semi-dark-blue', ['#1F60C4', '#3274D9']);
export const LightBlue = buildColorDefinition('blue', 'light-blue', ['#5794F2', '#8AB8FF']);
export const SuperLightBlue = buildColorDefinition('blue', 'super-light-blue', ['#8AB8FF', '#C0D8FF']);

export const BasicOrange = buildColorDefinition('orange', 'orange', ['#FF780A', '#FF9830'], true);
export const DarkOrange = buildColorDefinition('orange', 'dark-orange', ['#E55400', '#FA6400']);
export const SemiDarkOrange = buildColorDefinition('orange', 'semi-dark-orange', ['#FA6400', '#FF780A']);
export const LightOrange = buildColorDefinition('orange', 'light-orange', ['#FF9830', '#FFB357']);
export const SuperLightOrange = buildColorDefinition('orange', 'super-light-orange', ['#FFB357', '#FFCB7D']);

export const BasicPurple = buildColorDefinition('purple', 'purple', ['#A352CC', '#B877D9'], true);
export const DarkPurple = buildColorDefinition('purple', 'dark-purple', ['#7C2EA3', '#8F3BB8']);
export const SemiDarkPurple = buildColorDefinition('purple', 'semi-dark-purple', ['#8F3BB8', '#A352CC']);
export const LightPurple = buildColorDefinition('purple', 'light-purple', ['#B877D9', '#CA95E5']);
export const SuperLightPurple = buildColorDefinition('purple', 'super-light-purple', ['#CA95E5', '#DEB6F2']);

const greens = [BasicGreen, DarkGreen, SemiDarkGreen, LightGreen, SuperLightGreen];
const yellows = [BasicYellow, DarkYellow, SemiDarkYellow, LightYellow, SuperLightYellow];
const reds = [BasicRed, DarkRed, SemiDarkRed, LightRed, SuperLightRed];
const blues = [BasicBlue, DarkBlue, SemiDarkBlue, LightBlue, SuperLightBlue];
const oranges = [BasicOrange, DarkOrange, SemiDarkOrange, LightOrange, SuperLightOrange];
const purples = [BasicPurple, DarkPurple, SemiDarkPurple, LightPurple, SuperLightPurple];

ColorsPalette.set('green', greens);
ColorsPalette.set('yellow', yellows);
ColorsPalette.set('red', reds);
ColorsPalette.set('blue', blues);
ColorsPalette.set('orange', oranges);
ColorsPalette.set('purple', purples);

export const getColorDefinition = (hex: string, theme: GrafanaTheme): ColorDefinition | undefined => {
  return flatten(Array.from(ColorsPalette.values())).filter(definition => definition.variants[theme]  === hex)[0];
};

const isHex = (color: string) => {
  const hexRegex = /^((0x){0,1}|#{0,1})([0-9A-F]{8}|[0-9A-F]{6})$/gi;
  return hexRegex.test(color);
};

export const getColorName = (color?: string, theme?: GrafanaTheme): Color | undefined => {
  if (!color) {
    return undefined;
  }

  if (color.indexOf('rgb') > -1) {
    return undefined;
  }
  if (isHex(color)) {
    const definition = getColorDefinition(color, theme || GrafanaTheme.Dark);
    return definition ? definition.name : undefined;
  }

  return color as Color;
};

export const getColorByName = (colorName: string) => {
  const definition = flatten(Array.from(ColorsPalette.values())).filter(definition => definition.name === colorName);
  return definition.length > 0 ? definition[0] : undefined;
};

export const getColorFromHexRgbOrName = (color: string, theme?: GrafanaTheme): string => {
  if (color.indexOf('rgb') > -1 || isHex(color)) {
    return color;
  }

  const colorDefinition = getColorByName(color);

  if (!colorDefinition) {
    throw new Error('Unknown color');
  }

  return theme ? colorDefinition.variants[theme] : colorDefinition.variants.dark;
};

export const getColorForTheme = (color: ColorDefinition, theme?: GrafanaTheme) => {
  return theme ? color.variants[theme] : color.variants.dark;
};
