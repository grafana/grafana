import { merge } from 'lodash';
import { darken, emphasize, getContrastRatio, lighten } from './colorManipulator';
import { colors } from './colors';
import { DeepPartial, ThemePaletteColor } from './types';

/** @internal */
export type ThemePaletteMode = 'light' | 'dark';

/** @internal */
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
    /** Used for auto white or dark text on colored backgrounds */
    maxContrast: string;
  };

  layer0: string;
  layer1: string;
  layer2: string;

  divider: string;

  border0: string;
  border1: string;
  border2: string;

  action: {
    /** Used for selected menu item / select option */
    selected: string;
    /** Used for hovered menu item / select option */
    hover: string;
    /** Used for button/colored background hover opacity */
    hoverOpacity: number;
    /** Used focused menu item / select option */
    focus: string;
    /** Used for disabled buttons and inputs */
    disabledBackground: string;
    /** Disabled text */
    disabledText: string;
    /** Disablerd opacity */
    disabledOpacity: number;
  };

  hoverFactor: number;
  contrastThreshold: number;
  tonalOffset: number;
}

export interface ThemeHoverStrengh {}

/** @beta */
export interface ThemePalette extends ThemePaletteBase<ThemePaletteColor> {
  /** Returns a text color for the background */
  getContrastText(background: string): string;
  /* Return a hover color for any color */
  getHoverColor(color: string, hoverFactor?: number): string;
}

/** @internal */
export type ThemePaletteInput = DeepPartial<ThemePaletteBase<ThemePaletteColor>>;

class DarkPalette implements ThemePaletteBase<Partial<ThemePaletteColor>> {
  mode: ThemePaletteMode = 'dark';

  text = {
    primary: 'rgba(255, 255, 255, 0.75)',
    secondary: 'rgba(255, 255, 255, 0.50)',
    disabled: 'rgba(255, 255, 255, 0.35)',
    link: colors.blueDarkText,
    maxContrast: colors.white,
  };

  primary = {
    main: colors.blueDarkMain,
    text: colors.blueDarkText,
    border: colors.blueDarkText,
  };

  secondary = {
    main: 'rgba(255,255,255,0.1)',
    shade: 'rgba(255,255,255,0.15)',
    text: 'rgba(255,255,255,0.13)',
    contrastText: 'rgba(255, 255, 255, 0.8)',
  };

  info = this.primary;

  error = {
    main: colors.redDarkMain,
    text: colors.redDarkText,
  };

  success = {
    main: colors.greenDarkMain,
    text: colors.greenDarkText,
  };

  warning = {
    main: colors.orangeDarkMain,
    text: colors.orangeDarkText,
  };

  layer0 = colors.gray05;
  layer1 = colors.gray10;
  layer2 = colors.gray15;

  divider = 'rgba(218,224,254,0.06)';

  border0 = this.layer1;
  border1 = 'rgba(218,224,254,0.15)';
  border2 = 'rgba(218,224,254,0.20)';

  action = {
    hover: 'rgba(255, 255, 255, 0.08)',
    selected: 'rgba(255, 255, 255, 0.12)',
    focus: 'rgba(255, 255, 255, 0.16)',
    hoverOpacity: 0.08,
    disabledText: this.text.disabled,
    disabledBackground: 'rgba(255,255,255,0.07)',
    disabledOpacity: 0.38,
  };

  contrastThreshold = 3;
  hoverFactor = 0.15;
  tonalOffset = 0.15;
}

class LightPalette implements ThemePaletteBase<Partial<ThemePaletteColor>> {
  mode: ThemePaletteMode = 'light';

  primary = {
    main: colors.blueLightMain,
    border: colors.blueLightText,
    text: colors.blueLightText,
  };

  secondary = {
    main: 'rgba(0,0,0,0.11)',
    shade: 'rgba(0,0,0,0.16)',
    contrastText: 'rgba(0, 0, 0, 0.75)',
  };

  info = {
    main: colors.blueLightMain,
    text: colors.blueLightText,
  };

  error = {
    main: colors.redLightMain,
    text: colors.redLightText,
    border: colors.redLightText,
  };

  success = {
    main: colors.greenLightMain,
    text: colors.greenLightText,
  };

  warning = {
    main: colors.orangeLightMain,
    text: colors.orangeLightText,
  };

  text = {
    primary: 'rgba(0, 0, 0, 0.87)',
    secondary: 'rgba(0, 0, 0, 0.55)',
    disabled: 'rgba(0, 0, 0, 0.40)',
    link: this.primary.text,
    maxContrast: colors.black,
  };

  layer0 = colors.gray90;
  layer1 = colors.white;
  layer2 = colors.gray100;

  divider = 'rgba(0, 2, 78, 0.07)';

  border0 = this.layer1;

  border1 = 'rgba(0, 2, 78, 0.20)';
  border2 = 'rgba(0, 2, 78, 0.30)';

  action = {
    hover: 'rgba(0, 0, 0, 0.04)',
    selected: 'rgba(0, 0, 0, 0.08)',
    hoverOpacity: 0.08,
    focus: 'rgba(0, 0, 0, 0.12)',
    disabledBackground: 'rgba(0,0,0,0.07)',
    disabledText: this.text.disabled,
    disabledOpacity: 0.38,
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
      getContrastRatio(background, dark.text.primary) >= contrastThreshold
        ? dark.text.maxContrast
        : light.text.maxContrast;
    // todo, need color framework
    return contrastText;
  }

  function getHoverColor(color: string, factorOverride?: number) {
    return emphasize(color, factorOverride ?? hoverFactor);
  }

  const getRichColor = ({ color, name }: GetRichColorProps): ThemePaletteColor => {
    color = { ...color, name };
    if (!color.main) {
      throw new Error(`Missing main color for ${name}`);
    }
    if (!color.text) {
      color.text = color.main;
    }
    if (!color.border) {
      color.text = color.text;
    }
    if (!color.shade) {
      color.shade = base.mode === 'light' ? darken(color.main, tonalOffset) : lighten(color.main, tonalOffset);
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
      getHoverColor,
    },
    other
  );
}

interface GetRichColorProps {
  color: Partial<ThemePaletteColor>;
  name: string;
}
