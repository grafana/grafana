import { flatten, some, values } from 'lodash';

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

export const ColorsPalete = new Map<Hue, ColorDefinition[]>();

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

export const BasicGreen = buildColorDefinition('green', 'green', ['#53A642', '#53A642'], true);
export const DarkGreen = buildColorDefinition('green', 'dark-green', ['#106100', '#106100']);
export const SemiDarkGreen = buildColorDefinition('green', 'semi-dark-green', ['#388729', '#388729']);
export const LightGreen = buildColorDefinition('green', 'light-green', ['#72C462', '#72C462']);
export const SuperLightGreen = buildColorDefinition('green', 'super-light-green', ['#99E68A', '#99E68A']);

export const BasicYellow = buildColorDefinition('yellow', 'yellow', ['#F2CA00', '#F2CA00'], true);
export const DarkYellow = buildColorDefinition('yellow', 'dark-yellow', ['#A68A00', '#A68A00']);
export const SemiDarkYellow = buildColorDefinition('yellow', 'semi-dark-yellow', ['#CCAA00', '#CCAA00']);
export const LightYellow = buildColorDefinition('yellow', 'light-yellow', ['#F7D636', '#F7D636']);
export const SuperLightYellow = buildColorDefinition('yellow', 'super-light-yellow', ['#FFEB8A', '#FFEB8A']);

export const BasicRed = buildColorDefinition('red', 'red', ['#F94462', '#F94462'], true);
export const DarkRed = buildColorDefinition('red', 'dark-red', ['#B3001D', '#B3001D']);
export const SemiDarkRed = buildColorDefinition('red', 'semi-dark-red', ['#D93651', '#D93651']);
export const LightRed = buildColorDefinition('red', 'light-red', ['#F07387', '#F07387']);
export const SuperLightRed = buildColorDefinition('red', 'super-light-red', ['#E6A1AC', '#E6A1AC']);

export const BasicBlue = buildColorDefinition('blue', 'blue', ['#408BFF', '#408BFF'], true);
export const DarkBlue = buildColorDefinition('blue', 'dark-blue', ['#2155A6', '#2155A6']);
export const SemiDarkBlue = buildColorDefinition('blue', 'semi-dark-blue', ['#3471CF', '#3471CF']);
export const LightBlue = buildColorDefinition('blue', 'light-blue', ['#7DAEFA', '#7DAEFA']);
export const SuperLightBlue = buildColorDefinition('blue', 'super-light-blue', ['#B8D0F5', '#B8D0F5']);

export const BasicOrange = buildColorDefinition('orange', 'orange', ['#FA6400', '#FA6400'], true);
export const DarkOrange = buildColorDefinition('orange', 'dark-orange', ['#963C00', '#963C00']);
export const SemiDarkOrange = buildColorDefinition('orange', 'semi-dark-orange', ['#ED4B00', '#ED4B00']);
export const LightOrange = buildColorDefinition('orange', 'light-orange', ['#FC934C', '#FC934C']);
export const SuperLightOrange = buildColorDefinition('orange', 'super-light-orange', ['#FFC299', '#FFC299']);

export const BasicPurple = buildColorDefinition('purple', 'purple', ['#BC67E6', '#BC67E6'], true);
export const DarkPurple = buildColorDefinition('purple', 'dark-purple', ['#701F99', '#701F99']);
export const SemiDarkPurple = buildColorDefinition('purple', 'semi-dark-purple', ['#9E43CC', '#9E43CC']);
export const LightPurple = buildColorDefinition('purple', 'light-purple', ['#D19AED', '#D19AED']);
export const SuperLightPurple = buildColorDefinition('purple', 'super-light-purple', ['#E6CEF2', '#E6CEF2']);

const greens = [BasicGreen, DarkGreen, SemiDarkGreen, LightGreen, SuperLightGreen];
const yellows = [BasicYellow, DarkYellow, SemiDarkYellow, LightYellow, SuperLightYellow];
const reds = [BasicRed, DarkRed, SemiDarkRed, LightRed, SuperLightRed];
const blues = [BasicBlue, DarkBlue, SemiDarkBlue, LightBlue, SuperLightBlue];
const oranges = [BasicOrange, DarkOrange, SemiDarkOrange, LightOrange, SuperLightOrange];
const purples = [BasicPurple, DarkPurple, SemiDarkPurple, LightPurple, SuperLightPurple];

ColorsPalete.set('green', greens);
ColorsPalete.set('yellow', yellows);
ColorsPalete.set('red', reds);
ColorsPalete.set('blue', blues);
ColorsPalete.set('orange', oranges);
ColorsPalete.set('purple', purples);

export const getColorDefinition = (hex: string): ColorDefinition | undefined => {
  return flatten(Array.from(ColorsPalete.values())).filter(definition =>
    some(values(definition.variants), color => color === hex)
  )[0];
};

export const getColorName = (hex: string): Color | undefined => {
  const definition = getColorDefinition(hex);

  return definition ? definition.name : undefined;
};
