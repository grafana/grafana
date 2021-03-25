import { DeepPartial } from './types';

export interface ThemeRichColor {
  name: string;
  main: string;
  light: string;
  dark: string;
  contrastText: string;
}

export interface ThemeColors {
  mode: 'light' | 'dark';

  primary: ThemeRichColor;
  secondary: ThemeRichColor;
  error: ThemeRichColor;
  success: ThemeRichColor;
  warning: ThemeRichColor;
  info: ThemeRichColor;

  background: {
    layer0: string;
    layer1: string;
    layer2: string;
    layer3: string;
  };

  border: {
    b1: string;
    b2: string;
    b3: string;
  };

  text: {
    primary: string;
    secondary: string;
    disabled: string;
  };

  contrastThreshold: number;

  getContrastText: (backgroundColor: string) => string;
}

export function createColors(colors: DeepPartial<ThemeColors>): ThemeColors {}
