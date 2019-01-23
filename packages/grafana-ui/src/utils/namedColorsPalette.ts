import { flatten, some, values } from 'lodash';
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

export const BasicGreen = buildColorDefinition('green', 'green', ['#5AA64B', '#77BF69'], true);
export const DarkGreen = buildColorDefinition('green', 'dark-green', ['#1E6910', '#388729']);
export const SemiDarkGreen = buildColorDefinition('green', 'semi-dark-green', ['#388729', '#5AA64B']);
export const LightGreen = buildColorDefinition('green', 'light-green', ['#77BF69', '#99D98D']);
export const SuperLightGreen = buildColorDefinition('green', 'super-light-green', ['#99D98D', '#CAF2C2']);

export const BasicYellow = buildColorDefinition('yellow', 'yellow', ['#F2CC0C', '#FADE2A'], true);
export const DarkYellow = buildColorDefinition('yellow', 'dark-yellow', ['#CC9D00', '#E0B400']);
export const SemiDarkYellow = buildColorDefinition('yellow', 'semi-dark-yellow', ['#E0B400', '#F2CC0C']);
export const LightYellow = buildColorDefinition('yellow', 'light-yellow', ['#FADE2A', '#FFEE52']);
export const SuperLightYellow = buildColorDefinition('yellow', 'super-light-yellow', ['#FFEE52', '#FFF899']);

export const BasicRed = buildColorDefinition('red', 'red', ['#DE314D', '#F24965'], true);
export const DarkRed = buildColorDefinition('red', 'dark-red', ['#AB031F', '#C41834']);
export const SemiDarkRed = buildColorDefinition('red', 'semi-dark-red', ['#C41834', '#DE314D']);
export const LightRed = buildColorDefinition('red', 'light-red', ['#F24965', '#FF7389']);
export const SuperLightRed = buildColorDefinition('red', 'super-light-red', ['#FF7389', '#FFA6B4']);

export const BasicBlue = buildColorDefinition('blue', 'blue', ['#3274D9', '#5794F2'], true);
export const DarkBlue = buildColorDefinition('blue', 'dark-blue', ['#144796', '#1857B8']);
export const SemiDarkBlue = buildColorDefinition('blue', 'semi-dark-blue', ['#1857B8', '#3274D9']);
export const LightBlue = buildColorDefinition('blue', 'light-blue', ['#5794F2', '#8AB8FF']);
export const SuperLightBlue = buildColorDefinition('blue', 'super-light-blue', ['#8AB8FF', '#C0D8FF']);

export const BasicOrange = buildColorDefinition('orange', 'orange', ['#FF780A', '#FF9830'], true);
export const DarkOrange = buildColorDefinition('orange', 'dark-orange', ['#E55400', '#FA6400']);
export const SemiDarkOrange = buildColorDefinition('orange', 'semi-dark-orange', ['#FA6400', '#FF780A']);
export const LightOrange = buildColorDefinition('orange', 'light-orange', ['#FF9830', '#FFB357']);
export const SuperLightOrange = buildColorDefinition('orange', 'super-light-orange', ['#FFB357', '#FFCB7D']);

export const BasicPurple = buildColorDefinition('purple', 'purple', ['#A352CC', '#B877D9'], true);
export const DarkPurple = buildColorDefinition('purple', 'dark-purple', ['#732699', '#8936B2']);
export const SemiDarkPurple = buildColorDefinition('purple', 'semi-dark-purple', ['#8936B2', '#A352CC']);
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

export const getColorDefinition = (hex: string): ColorDefinition | undefined => {
  return flatten(Array.from(ColorsPalette.values())).filter(definition =>
    some(values(definition.variants), color => color === hex)
  )[0];
};

const isHex = (color: string) => {
  const hexRegex = /^((0x){0,1}|#{0,1})([0-9A-F]{8}|[0-9A-F]{6})$/gi;
  return hexRegex.test(color);
};

export const getColorName = (color?: string): Color | undefined => {
  if (!color) {
    return undefined;
  }

  if (color.indexOf('rgb') > -1) {
    return undefined;
  }
  if (isHex(color)) {
    const definition = getColorDefinition(color);
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
