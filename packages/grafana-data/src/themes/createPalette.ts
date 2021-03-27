import { merge } from 'lodash';
import { colors } from './colors';
import { DeepPartial } from './types';

export interface ThemePaletteColor {
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

export interface ThemePaletteBase<TColor> {
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

export interface ThemePalette extends ThemePaletteBase<ThemePaletteColor> {
  /** Returns a text color for the background */
  textForBg(background: string): string;
  /* Retruns a hover color for any background */
  forHover(background: string): string;
}

export type ThemePaletteInput = DeepPartial<ThemePaletteBase<ThemePaletteColor>>;

const dark: ThemePaletteBase<Partial<ThemePaletteColor>> = {
  mode: 'dark',
  primary: {
    main: colors.blue80,
  },
  secondary: {
    main: colors.gray15,
  },
  info: {
    main: colors.blue80,
  },
  error: {
    main: colors.red88,
  },
  success: {
    main: colors.greenBase,
  },
  warning: {
    main: colors.orange,
  },
  background: {
    layer0: colors.gray05,
    layer1: colors.gray10,
    layer2: colors.gray15,
  },
  border: {
    layer0: colors.gray15,
    layer1: colors.gray25,
    layer2: colors.gray33,
  },
  text: {
    primary: 'rgba(255, 255, 255, 0.7)',
    secondary: 'rgba(255, 255, 255, 0.55)',
    disabled: 'rgba(255, 255, 255, 0.38)',
  },
  contrastThreshold: 3,
  hoverFactor: 1.1,
};

const light: ThemePaletteBase<Partial<ThemePaletteColor>> = {
  mode: 'light',
  primary: {
    main: colors.blue80,
  },
  secondary: {
    main: colors.gray15,
  },
  info: {
    main: colors.blue80,
  },
  error: {
    main: colors.red88,
  },
  success: {
    main: colors.greenBase,
  },
  warning: {
    main: colors.orange,
  },
  background: {
    layer0: colors.gray98,
    layer1: colors.white,
    layer2: colors.gray97,
  },
  border: {
    layer0: colors.gray90,
    layer1: colors.gray85,
    layer2: colors.gray70,
  },
  text: {
    primary: 'rgba(0, 0, 0, 0.87)',
    secondary: 'rgba(0, 0, 0, 0.54)',
    disabled: 'rgba(0, 0, 0, 0.38)',
  },
  contrastThreshold: 3,
  hoverFactor: 1.1,
};

export function createPalette(palette: ThemePaletteInput): ThemePalette {
  const base = (palette.mode ?? 'dark') === 'dark' ? dark : light;
  const {
    primary = base.primary,
    secondary = base.secondary,
    info = base.info,
    warning = base.warning,
    success = base.success,
    error = base.error,
    ...other
  } = palette;

  function textForBg(color: string) {
    // todo, need color framework
    return color;
  }

  function forHover(color: string) {
    return color;
  }

  const getRichColor = ({ color, name }: GetRichColorProps): ThemePaletteColor => {
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
      textForBg,
      forHover,
    },
    other
  );
}

interface GetRichColorProps {
  color: Partial<ThemePaletteColor>;
  name: string;
}
