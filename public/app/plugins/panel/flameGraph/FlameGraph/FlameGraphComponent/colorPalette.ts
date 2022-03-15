import Color from 'color';

// FlamegraphPalette represents
export interface FlamegraphPalette {
  name: string;
  goodColor: Color;
  neutralColor: Color;
  badColor: Color;

  colors: Color[];
}

export const DefaultPalette: FlamegraphPalette = {
  name: 'Default',
  // green
  goodColor: Color.rgb(0, 170, 0),
  // grey
  neutralColor: Color.rgb(148, 142, 142),
  // red
  badColor: Color.rgb(200, 0, 0),

  colors: [
    Color.hsl(24, 69, 60),
    Color.hsl(34, 65, 65),
    Color.hsl(194, 52, 61),
    Color.hsl(163, 45, 55),
    Color.hsl(211, 48, 60),
    Color.hsl(246, 40, 65),
    Color.hsl(305, 63, 79),
    Color.hsl(47, 100, 73),

    Color.rgb(183, 219, 171),
    Color.rgb(244, 213, 152),
    Color.rgb(112, 219, 237),
    Color.rgb(249, 186, 143),
    Color.rgb(242, 145, 145),
    Color.rgb(130, 181, 216),
    Color.rgb(229, 168, 226),
    Color.rgb(174, 162, 224),
    Color.rgb(154, 196, 138),
    Color.rgb(242, 201, 109),
    Color.rgb(101, 197, 219),
    Color.rgb(249, 147, 78),
    Color.rgb(234, 100, 96),
    Color.rgb(81, 149, 206),
    Color.rgb(214, 131, 206),
    Color.rgb(128, 110, 183),
  ],
};

export const ColorBlindPalette: FlamegraphPalette = {
  ...DefaultPalette,

  name: 'Color Blind',
  goodColor: Color.rgb(26, 133, 255),
  neutralColor: Color.rgb(148, 142, 142),
  badColor: Color.rgb(220, 50, 32),
};
