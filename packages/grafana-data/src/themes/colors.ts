import { merge } from 'lodash';
import { palette } from './palette';
import { DeepPartial } from './types';

export interface ThemeRichColor {
  name: string;
  main: string;
  light: string;
  dark: string;
  contrastText: string;
}

export interface ThemeColorsBase<TColor> {
  mode: 'light' | 'dark';

  primary: TColor;
  secondary: TColor;

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
}

export interface ThemeColors extends ThemeColorsBase<ThemeRichColor> {
  getContrastText(background: string): string;
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
  background: {
    layer0: palette.gray05,
    layer1: palette.gray10,
    layer2: palette.gray15,
    layer3: palette.gray25,
  },
  border: {
    b1: palette.gray10,
    b2: palette.gray15,
    b3: palette.gray25,
  },
  text: {
    primary: palette.gray85,
    secondary: palette.gray60,
    disabled: palette.gray33,
  },
  contrastThreshold: 3,
};

const light: ThemeColorsBase<Partial<ThemeRichColor>> = {
  mode: 'light',
  primary: {
    main: palette.blue80,
  },
  secondary: {
    main: palette.gray15,
  },
  background: {
    layer0: palette.gray05,
    layer1: palette.gray10,
    layer2: palette.gray15,
    layer3: palette.gray25,
  },
  border: {
    b1: palette.gray10,
    b2: palette.gray15,
    b3: palette.gray25,
  },
  text: {
    primary: palette.gray33,
    secondary: palette.gray60,
    disabled: palette.gray70,
  },
  contrastThreshold: 3,
};

export function createColors(colors: ThemeColorsInput): ThemeColors {
  const base = (colors.mode ?? 'dark') === 'dark' ? dark : light;
  const { primary = base.primary, secondary = base.secondary, ...other } = colors;

  function getContrastText(color: string) {
    return color;
  }

  const getRichColor = ({ color, name }: GetRichColorProps): ThemeRichColor => {
    color = { ...color };
    if (!color.main) {
      throw new Error(`Missing main color for ${name}`);
    }

    color.name = name;
    return color as ThemeRichColor;
  };

  return merge(
    {
      ...base,
      primary: getRichColor({ color: primary, name: 'primary' }),
      secondary: getRichColor({ color: secondary, name: 'secondary' }),
      getContrastText,
    },
    other
  );
}

interface GetRichColorProps {
  color: Partial<ThemeRichColor>;
  name: string;
}
