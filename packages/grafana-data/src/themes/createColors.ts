import { merge } from 'lodash';
import { palette } from './palette';
import { DeepPartial } from './types';

export interface ThemeRichColor {
  /** color intent (primary, secondary, info, error, etc) */
  name: string;
  /** Main color */
  main: string;
  /** Light shade */
  light: string;
  /** Dark shade */
  dark: string;
  /** Text color for text ontop of main */
  contrastText: string;
}

export interface ThemeColorsBase<TColor> {
  mode: 'light' | 'dark';

  primary: TColor;
  secondary: TColor;
  info: TColor;
  error: TColor;
  success: TColor;
  warning: TColor;

  background: {
    layer0: string;
    layer1: string;
    layer2: string;
    layer3: string;
  };

  border: {
    layer0: string;
    layer1: string;
    layer2: string;
  };

  text: {
    primary: string;
    secondary: string;
    disabled: string;
  };

  hoverFactor: number;
  contrastThreshold: number;
}

export interface ThemeColors extends ThemeColorsBase<ThemeRichColor> {
  /** Returns a text color for the background */
  textForBg(background: string): string;
  /* Retruns a hover color for any background */
  forHover(background: string): string;
}

export type ThemeColorsInput = DeepPartial<ThemeColorsBase<ThemeRichColor>>;

const dark: ThemeColorsBase<Partial<ThemeRichColor>> = {
  mode: 'dark',
  primary: {
    main: palette.blue80,
  },
  secondary: {
    main: palette.gray15,
  },
  info: {
    main: palette.blue80,
  },
  error: {
    main: palette.red88,
  },
  success: {
    main: palette.greenBase,
  },
  warning: {
    main: palette.orange,
  },
  background: {
    layer0: palette.gray05,
    layer1: palette.gray10,
    layer2: palette.gray15,
    layer3: palette.gray25,
  },
  border: {
    layer0: palette.gray10,
    layer1: palette.gray15,
    layer2: palette.gray25,
  },
  text: {
    primary: 'rgba(255, 255, 255, 0.8)',
    secondary: 'rgba(255, 255, 255, 0.6)',
    disabled: 'rgba(255, 255, 255, 0.4)',
  },
  contrastThreshold: 3,
  hoverFactor: 1.1,
};

const light: ThemeColorsBase<Partial<ThemeRichColor>> = {
  mode: 'light',
  primary: {
    main: palette.blue80,
  },
  secondary: {
    main: palette.gray15,
  },
  info: {
    main: palette.blue80,
  },
  error: {
    main: palette.red88,
  },
  success: {
    main: palette.greenBase,
  },
  warning: {
    main: palette.orange,
  },
  background: {
    layer0: palette.gray05,
    layer1: palette.gray10,
    layer2: palette.gray15,
    layer3: palette.gray25,
  },
  border: {
    layer0: palette.gray10,
    layer1: palette.gray15,
    layer2: palette.gray25,
  },
  text: {
    primary: 'rgba(0, 0, 0, 0.87)',
    secondary: 'rgba(0, 0, 0, 0.54)',
    disabled: 'rgba(0, 0, 0, 0.38)',
  },
  contrastThreshold: 3,
  hoverFactor: 1.1,
};

export function createColors(colors: ThemeColorsInput): ThemeColors {
  const base = (colors.mode ?? 'dark') === 'dark' ? dark : light;
  const {
    primary = base.primary,
    secondary = base.secondary,
    info = base.info,
    warning = base.warning,
    success = base.success,
    error = base.error,
    ...other
  } = colors;

  function textForBg(color: string) {
    // todo, need color framework
    return color;
  }

  function forHover(color: string) {
    return color;
  }

  const getRichColor = ({ color, name }: GetRichColorProps): ThemeRichColor => {
    color = { ...color, name };
    if (!color.main) {
      throw new Error(`Missing main color for ${name}`);
    }
    if (!color.dark) {
      // missing color manipulation functions in grafana/data
      color.dark = 'darken(color.main, tonalOffset)';
    }
    if (!color.light) {
      // missing color manipulation functions in grafana/data
      color.light = 'lighten(color.main, tonalOffset)';
    }
    if (!color.contrastText) {
      color.contrastText = textForBg(color.main);
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
      textForBg,
      forHover,
    },
    other
  );
}

interface GetRichColorProps {
  color: Partial<ThemeRichColor>;
  name: string;
}
