import { merge } from 'lodash';
import { emphasize, getContrastRatio } from './colorManipulator';
import { colors } from './colors';
import { DeepPartial, ThemePaletteColor } from './types';

export type ThemePaletteMode = 'light' | 'dark';
export interface ThemePaletteBase<TColor> {
  mode: ThemePaletteMode;

  primary: TColor;
  secondary: TColor;
  info: TColor;
  error: TColor;
  success: TColor;
  warning: TColor;

  text: {
    primary: string;
    secondary: string;
    disabled: string;
    link: string;
  };

  background: {
    layer0: string;
    layer1: string;
    layer2: string;
  };

  border: {
    layer0: string;
    layer1: string;
    layer2: string;
  };

  formComponent: {
    background: string;
    disabledBackground: string;
    border: string;
  };

  hoverFactor: number;
  contrastThreshold: number;
  tonalOffset: number;
}

export interface ThemePalette extends ThemePaletteBase<ThemePaletteColor> {
  /** Returns a text color for the background */
  getContrastText(background: string): string;
  /* Retruns a hover color for any background */
  getHoverBackground(background: string): string;
}

export type ThemePaletteInput = DeepPartial<ThemePaletteBase<ThemePaletteColor>>;

class DarkPalette implements ThemePaletteBase<Partial<ThemePaletteColor>> {
  mode: ThemePaletteMode = 'dark';

  text = {
    primary: 'rgba(255, 255, 255, 0.75)',
    secondary: 'rgba(255, 255, 255, 0.50)',
    disabled: 'rgba(255, 255, 255, 0.3)',
    link: colors.blueDark2,
  };

  primary = {
    main: colors.blueDark1,
    border: colors.blueDark2,
    text: colors.blueDark2,
  };

  secondary = {
    main: 'rgba(255,255,255,0.1)',
    contrastText: 'rgba(255, 255, 255, 0.8)',
  };

  info = this.primary;

  error = {
    main: colors.redDark1,
    border: colors.redDark2,
    text: colors.redDark2,
  };

  success = {
    main: colors.green1,
    text: colors.green2,
    border: colors.green2,
  };

  warning = {
    main: colors.orange,
  };

  background = {
    layer0: colors.gray05,
    layer1: colors.gray10,
    layer2: colors.gray15,
  };

  border = {
    layer0: colors.gray15,
    layer1: colors.gray25,
    layer2: colors.gray33,
  };

  formComponent = {
    background: this.background.layer0,
    border: this.border.layer1,
    disabledBackground: colors.gray10,
  };

  contrastThreshold = 3;
  hoverFactor = 0.15;
  tonalOffset = 0.1;
}

class LightPalette implements ThemePaletteBase<Partial<ThemePaletteColor>> {
  mode: ThemePaletteMode = 'light';

  primary = {
    main: colors.blueLight1,
    border: colors.blueLight3,
    text: colors.blueLight3,
  };

  secondary = {
    main: 'rgba(0,0,0,0.2)',
    contrastText: 'rgba(0, 0, 0, 0.87)',
  };

  info = {
    main: colors.blueLight1,
    text: colors.blueLight3,
  };

  error = {
    main: colors.redLight1,
    text: colors.redLight2,
    border: colors.redLight2,
  };

  success = {
    main: colors.greenBase,
  };

  warning = {
    main: colors.orange,
  };

  text = {
    primary: 'rgba(0, 0, 0, 0.87)',
    secondary: 'rgba(0, 0, 0, 0.54)',
    disabled: 'rgba(0, 0, 0, 0.38)',
    link: this.primary.text,
  };

  background = {
    layer0: colors.gray98,
    layer1: colors.white,
    layer2: colors.gray97,
  };

  border = {
    layer0: colors.gray90,
    layer1: colors.gray85,
    layer2: colors.gray70,
  };

  formComponent = {
    background: this.background.layer1,
    border: this.border.layer1,
    disabledBackground: colors.gray95,
  };

  contrastThreshold = 3;
  hoverFactor = 0.15;
  tonalOffset = 0.2;
}

export function createPalette(palette: ThemePaletteInput): ThemePalette {
  const dark = new DarkPalette();
  const light = new LightPalette();
  const base = (palette.mode ?? 'dark') === 'dark' ? dark : light;
  const {
    primary = base.primary,
    secondary = base.secondary,
    info = base.info,
    warning = base.warning,
    success = base.success,
    error = base.error,
    tonalOffset = base.tonalOffset,
    hoverFactor = base.hoverFactor,
    contrastThreshold = base.contrastThreshold,
    ...other
  } = palette;

  function getContrastText(background: string) {
    const contrastText =
      getContrastRatio(background, dark.text.primary) >= contrastThreshold ? colors.white : colors.black;
    // todo, need color framework
    return contrastText;
  }

  function getHoverBackground(color: string) {
    return emphasize(color, hoverFactor);
  }

  const getRichColor = ({ color, name }: GetRichColorProps): ThemePaletteColor => {
    color = { ...color, name };
    if (!color.main) {
      throw new Error(`Missing main color for ${name}`);
    }
    if (!color.border) {
      color.border = color.main;
    }
    if (!color.text) {
      color.text = color.main;
    }
    if (!color.contrastText) {
      color.contrastText = getContrastText(color.main);
    }
    return color as ThemePaletteColor;
  };

  return merge(
    {
      ...base,
      primary: getRichColor({ color: primary, name: 'primary' }),
      secondary: getRichColor({ color: secondary, name: 'secondary' }),
      info: getRichColor({ color: info, name: 'info' }),
      error: getRichColor({ color: error, name: 'error' }),
      success: getRichColor({ color: success, name: 'success' }),
      warning: getRichColor({ color: warning, name: 'warning' }),
      getContrastText,
      getHoverBackground,
    },
    other
  );
}

interface GetRichColorProps {
  color: Partial<ThemePaletteColor>;
  name: string;
}
