import { merge } from 'lodash';

import { alpha, darken, emphasize, getContrastRatio, lighten } from './colorManipulator';
import { palette } from './palette';
import { DeepPartial, ThemeRichColor } from './types';
import {ThemeColorsBase, ThemeColorsMode, ThemeColors} from './createColors'


/** @internal */
export type ThemeColorsInput = DeepPartial<ThemeColorsBase<ThemeRichColor>>;

class FnDarkColors implements ThemeColorsBase<Partial<ThemeRichColor>> {
  mode: ThemeColorsMode = 'dark';

  // Used to get more white opacity colors
  whiteBase = '219, 217, 215';

  border = {
    weak: `rgba(${this.whiteBase}, 0.07)`,
    medium: `rgba(${this.whiteBase}, 0.15)`,
    strong: `rgba(${this.whiteBase}, 0.25)`,
  };

  text = {
    primary: '#DBD9D7',
    secondary: '#F0E4B6', // yellow
    disabled: '#9DA7B8',
    link: '#F0E4B6', // yellow
    maxContrast: '#F0E4B6', // yellow
  };

  primary = {
    main: '#3F8367',
    text: '#F0E4B6', // yellow
    border: '#ffffff00',
  };

  secondary = {
    main: '#F06929',
    shade: '#F0692955',
    text: this.text.primary,
    contrastText: `rgb(${this.whiteBase})`,
    border: this.border.strong,
  };

  info = this.primary;

  error = {
    main: palette.redDarkMain,
    text: palette.redDarkText,
  };

  success = {
    main: '#4BBF73',
    text: '#318B50',
  };

  warning = {
    main: '#CF8E07',
    text: this.text.primary,
  };

  background = {
    canvas: '#312D2B', //palette.gray05,
    primary: '#3B3835', //palette.gray10,
    secondary: '#5E5855', //palette.gray15,
  };

  action = {
    hover: `rgba(${this.whiteBase}, 0.16)`,
    selected: `rgba(${this.whiteBase}, 0.12)`,
    focus: `rgba(${this.whiteBase}, 0.16)`,
    hoverOpacity: 0.08,
    disabledText: this.text.disabled,
    disabledBackground: `rgba(${this.whiteBase}, 0.04)`,
    disabledOpacity: 0.38,
  };

  gradients = {
    brandHorizontal: 'linear-gradient(270deg, #F55F3E 0%, #FF8833 100%)',
    brandVertical: 'linear-gradient(0.01deg, #F55F3E 0.01%, #FF8833 99.99%)',
  };

  contrastThreshold = 3;
  hoverFactor = 0.03;
  tonalOffset = 0.15;
}

class FnLightColors implements ThemeColorsBase<Partial<ThemeRichColor>> {
  mode: ThemeColorsMode = 'light';

  blackBase = '45, 51, 62';

  primary = {
    main: '#8EC4AD',
    border: palette.blueLightText,
    text: '#2d333e', // yellow
  };

  text = {
    primary: '#2D333E',
    secondary: '#2d333e',
    disabled: '#9DA7B8',
    link: this.primary.text,
    maxContrast: palette.black,
  };

  border = {
    weak: `rgba(${this.blackBase}, 0.12)`,
    medium: `rgba(${this.blackBase}, 0.30)`,
    strong: `rgba(${this.blackBase}, 0.40)`,
  };

  secondary = {
    main: '#FC9A69',
    shade: '#FC9A6990',
    contrastText: `rgba(${this.blackBase},  1)`,
    text: this.text.primary,
    border: this.border.strong,
  };

  info = {
    main: '#64B6F7',
    text: palette.blueLightText,
  };

  error = {
    main: palette.redLightMain,
    text: palette.redLightText,
    border: palette.redLightText,
  };

  success = {
    main: '#83D39E',
    text: palette.greenLightText,
  };

  warning = {
    main: '#F3D086',
    text: palette.orangeLightText,
  };

  background = {
    canvas: '#F6F5F3',
    primary: '#FDFDFC',
    secondary: '#FDFDFC',
  };

  action = {
    hover: `rgba(${this.blackBase}, 0.12)`,
    selected: `#F27A40`,
    hoverOpacity: 0.08,
    focus: `rgba(${this.blackBase}, 0.12)`,
    disabledBackground: `rgba(${this.blackBase}, 0.04)`,
    disabledText: this.text.disabled,
    disabledOpacity: 0.38,
  };

  gradients = {
    brandHorizontal: 'linear-gradient(90deg, #FF8833 0%, #F53E4C 100%)',
    brandVertical: 'linear-gradient(0.01deg, #F53E4C -31.2%, #FF8833 113.07%)',
  };

  contrastThreshold = 3;
  hoverFactor = 0.03;
  tonalOffset = 0.2;
}

export function createFnColors(colors: ThemeColorsInput): ThemeColors {
  const dark = new FnDarkColors();
  const light = new FnLightColors();

  const base = (colors.mode ?? 'dark') === 'dark' ? dark : light;

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
  } = colors;

  function getContrastText(background: string, threshold: number = contrastThreshold) {
    const contrastText =
      getContrastRatio(dark.text.maxContrast, background, base.background.primary) >= threshold
        ? dark.text.maxContrast
        : light.text.maxContrast;
    // todo, need color framework
    return contrastText;
  }

  const getRichColor = ({ color, name }: GetRichColorProps): ThemeRichColor => {
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
    return color as ThemeRichColor;
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
  color: Partial<ThemeRichColor>;
  name: string;
}
