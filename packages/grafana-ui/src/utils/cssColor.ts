// CSS versions of colorManipulator's darken, lighten and emphasize. They use CSS relative color syntax, in which each
// channel of rgb(from …) is a number from 0 to 255, so they accept any CSS color and keep the color's alpha.

type Channel = 'r' | 'g' | 'b';

// 1 when value is greater than threshold, otherwise 0.
const isGreaterThan = (value: string, threshold: number) => `clamp(0, (${value} - ${threshold}) * 1000000, 1)`;

// The sRGB transfer function, which turns a 0 to 255 channel into linear light.
const linearize = (channel: Channel) => {
  const value = `(${channel} / 255)`;
  const isAboveToe = isGreaterThan(value, 0.03928);

  return `(${isAboveToe} * pow((${value} + 0.055) / 1.055, 2.4) + (1 - ${isAboveToe}) * ${value} / 12.92)`;
};

const relativeLuminance = `(0.2126 * ${linearize('r')} + 0.7152 * ${linearize('g')} + 0.0722 * ${linearize('b')})`;

const darkenChannel = (channel: Channel, coefficient: number) => `${channel} * ${1 - coefficient}`;
const lightenChannel = (channel: Channel, coefficient: number) => `(${channel} + (255 - ${channel}) * ${coefficient})`;

const fromChannels = (color: string, getChannel: (channel: Channel) => string) =>
  `rgb(from ${color} calc(${getChannel('r')}) calc(${getChannel('g')}) calc(${getChannel('b')}) / alpha)`;

/** Moves each channel of a color towards black by the coefficient, from 0 to 1. */
export const darkenColor = (color: string, coefficient: number) =>
  fromChannels(color, (channel) => darkenChannel(channel, coefficient));

/** Moves each channel of a color towards white by the coefficient, from 0 to 1. */
export const lightenColor = (color: string, coefficient: number) =>
  fromChannels(color, (channel) => lightenChannel(channel, coefficient));

/** Lightens a color whose relative luminance is above 0.5 and darkens any other color, by the coefficient. */
export const intensifyColor = (color: string, coefficient: number) => {
  const isLight = isGreaterThan(relativeLuminance, 0.5);

  return fromChannels(
    color,
    (channel) =>
      `${isLight} * ${lightenChannel(channel, coefficient)} + (1 - ${isLight}) * ${darkenChannel(channel, coefficient)}`
  );
};

/** Darkens a color whose relative luminance is above 0.5 and lightens any other color, by the coefficient. */
export const emphasizeColor = (color: string, coefficient: number) => {
  const isLight = isGreaterThan(relativeLuminance, 0.5);

  return fromChannels(
    color,
    (channel) =>
      `${isLight} * ${darkenChannel(channel, coefficient)} + (1 - ${isLight}) * ${lightenChannel(channel, coefficient)}`
  );
};
