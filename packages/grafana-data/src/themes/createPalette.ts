import { merge } from 'lodash';
import { alpha, darken, emphasize, getContrastRatio, lighten } from './colorManipulator';
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

  gradients: {
    brandVertical: string;
    brandHorizontal: string;
  };

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
  /* Brighten or darken a color by specified factor (0-1) */
  emphasize(color: string, amount?: number): string;
}

/** @internal */
export type ThemePaletteInput = DeepPartial<ThemePaletteBase<ThemePaletteColor>>;

class DarkPalette implements ThemePaletteBase<Partial<ThemePaletteColor>> {
  mode: ThemePaletteMode = 'dark';

  whiteBase = '201, 209, 217';

  text = {
    primary: `rgb(${this.whiteBase})`,
    secondary: `rgba(${this.whiteBase}, 0.65)`,
    disabled: `rgba(${this.whiteBase}, 0.40)`,
    link: colors.blueDarkText,
    maxContrast: colors.white,
  };

  primary = {
    main: colors.blueDarkMain,
    text: colors.blueDarkText,
    border: colors.blueDarkText,
  };

  secondary = {
    main: `rgba(${this.whiteBase}, 0.1)`,
    shade: `rgba(${this.whiteBase}, 0.15)`,
    text: `rgba(${this.whiteBase}, 0.13)`,
    contrastText: `rgb(${this.whiteBase})`,
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

  divider = `rgba(${this.whiteBase}, 0.10)`;

  border0 = this.layer1;
  border1 = `rgba(${this.whiteBase}, 0.15)`;
  border2 = `rgba(${this.whiteBase}, 0.20)`;

  action = {
    hover: `rgba(${this.whiteBase}, 0.08)`,
    selected: `rgba(${this.whiteBase}, 0.12)`,
    focus: `rgba(${this.whiteBase}, 0.16)`,
    hoverOpacity: 0.08,
    disabledText: this.text.disabled,
    disabledBackground: `rgba(${this.whiteBase}, 0.07)`,
    disabledOpacity: 0.38,
  };

  gradients = {
    brandHorizontal: ' linear-gradient(270deg, #F55F3E 0%, #FF8833 100%);',
    brandVertical: 'linear-gradient(0.01deg, #F55F3E 0.01%, #FF8833 99.99%);',
  };

  contrastThreshold = 3;
  hoverFactor = 0.03;
  tonalOffset = 0.15;
}

class LightPalette implements ThemePaletteBase<Partial<ThemePaletteColor>> {
  mode: ThemePaletteMode = 'light';

  blackBase = '36, 41, 46';

  primary = {
    main: colors.blueLightMain,
    border: colors.blueLightText,
    text: colors.blueLightText,
  };

  secondary = {
    main: `rgba(${this.blackBase}, 0.11)`,
    shade: `rgba(${this.blackBase}, 0.16)`,
    contrastText: `rgba(${this.blackBase},  1)`,
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
    primary: `rgba(${this.blackBase}, 1)`,
    secondary: `rgba(${this.blackBase}, 0.75)`,
    disabled: `rgba(${this.blackBase}, 0.50)`,
    link: this.primary.text,
    maxContrast: colors.black,
  };

  layer0 = colors.gray90;
  layer1 = colors.white;
  layer2 = colors.gray100;

  divider = `rgba(${this.blackBase}, 0.12)`;

  border0 = this.layer1;
  border1 = `rgba(${this.blackBase}, 0.30)`;
  border2 = `rgba(${this.blackBase}, 0.40)`;

  action = {
    hover: `rgba(${this.blackBase}, 0.04)`,
    selected: `rgba(${this.blackBase}, 0.08)`,
    hoverOpacity: 0.08,
    focus: `rgba(${this.blackBase}, 0.12)`,
    disabledBackground: `rgba(${this.blackBase}, 0.07)`,
    disabledText: this.text.disabled,
    disabledOpacity: 0.38,
  };

  gradients = {
    brandHorizontal: 'linear-gradient(90deg, #FF8833 0%, #F53E4C 100%);',
    brandVertical: 'linear-gradient(0.01deg, #F53E4C -31.2%, #FF8833 113.07%);',
  };

  contrastThreshold = 3;
  hoverFactor = 0.03;
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
      getContrastRatio(background, dark.text.maxContrast) >= contrastThreshold
        ? dark.text.maxContrast
        : light.text.maxContrast;
    // todo, need color framework
    return contrastText;
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
      color.border = color.text;
    }
    if (!color.shade) {
      color.shade = base.mode === 'light' ? darken(color.main, tonalOffset) : lighten(color.main, tonalOffset);
    }
    if (!color.transparent) {
      color.transparent = base.mode === 'light' ? alpha(color.main, 0.08) : alpha(color.main, 0.15);
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
      emphasize: (color: string, factor?: number) => {
        return emphasize(color, factor ?? hoverFactor);
      },
    },
    other
  );
}

interface GetRichColorProps {
  color: Partial<ThemePaletteColor>;
  name: string;
}
