import { merge } from 'lodash';
import { z } from 'zod';

import { alpha, darken, emphasize, getContrastRatio, lighten } from './colorManipulator';
import { palette } from './palette';
import { DeepRequired, ThemeRichColor, ThemeRichColorInputSchema } from './types';

const ThemeColorsModeSchema = z.enum(['light', 'dark']);
/** @internal */
export type ThemeColorsMode = z.infer<typeof ThemeColorsModeSchema>;

const createThemeColorsBaseSchema = <TColor>(color: TColor) =>
  z
    .object({
      mode: ThemeColorsModeSchema,

      primary: color,
      secondary: color,
      info: color,
      error: color,
      success: color,
      warning: color,

      text: z.object({
        primary: z.string().optional(),
        secondary: z.string().optional(),
        disabled: z.string().optional(),
        link: z.string().optional(),
        /** Used for auto white or dark text on colored backgrounds */
        maxContrast: z.string().optional(),
      }),

      background: z.object({
        /** Dashboard and body background */
        canvas: z.string().optional(),
        /** Primary content pane background (panels etc) */
        primary: z.string().optional(),
        /** Cards and elements that need to stand out on the primary background */
        secondary: z.string().optional(),
        /**
         * For popovers and menu backgrounds. This is the same color as primary in most light themes but in dark
         * themes it has a brighter shade to help give it contrast against the primary background.
         **/
        elevated: z.string().optional(),
      }),

      border: z.object({
        weak: z.string().optional(),
        medium: z.string().optional(),
        strong: z.string().optional(),
      }),

      gradients: z.object({
        brandVertical: z.string().optional(),
        brandHorizontal: z.string().optional(),
      }),

      action: z.object({
        /** Used for selected menu item / select option */
        selected: z.string().optional(),
        /**
         * @alpha (Do not use from plugins)
         * Used for selected items when background only change is not enough (Currently only used for FilterPill)
         **/
        selectedBorder: z.string().optional(),
        /** Used for hovered menu item / select option */
        hover: z.string().optional(),
        /** Used for button/colored background hover opacity */
        hoverOpacity: z.number().optional(),
        /** Used focused menu item / select option */
        focus: z.string().optional(),
        /** Used for disabled buttons and inputs */
        disabledBackground: z.string().optional(),
        /** Disabled text */
        disabledText: z.string().optional(),
        /** Disablerd opacity */
        disabledOpacity: z.number().optional(),
      }),

      scrollbar: z.string().optional(),
      hoverFactor: z.number(),
      contrastThreshold: z.number(),
      tonalOffset: z.number(),
    })
    .partial();

// Need to override the zod type to include the generic properly
/** @internal */
export type ThemeColorsBase<TColor> = DeepRequired<
  Omit<
    z.infer<ReturnType<typeof createThemeColorsBaseSchema>>,
    'primary' | 'secondary' | 'info' | 'error' | 'success' | 'warning'
  >
> & {
  primary: TColor;
  secondary: TColor;
  info: TColor;
  error: TColor;
  success: TColor;
  warning: TColor;
};

export interface ThemeHoverStrengh {}

/** @beta */
export interface ThemeColors extends ThemeColorsBase<ThemeRichColor> {
  /** Returns a text color for the background */
  getContrastText(background: string, threshold?: number): string;
  /* Brighten or darken a color by specified factor (0-1) */
  emphasize(color: string, amount?: number): string;
}

export const ThemeColorsInputSchema = createThemeColorsBaseSchema(ThemeRichColorInputSchema);

/** @internal */
export type ThemeColorsInput = z.infer<typeof ThemeColorsInputSchema>;

class DarkColors implements ThemeColorsBase<Partial<ThemeRichColor>> {
  mode: ThemeColorsMode = 'dark';

  // Used to get more white opacity colors
  whiteBase = '204, 204, 220';

  border = {
    weak: `rgba(${this.whiteBase}, 0.12)`,
    medium: `rgba(${this.whiteBase}, 0.2)`,
    strong: `rgba(${this.whiteBase}, 0.30)`,
  };

  text = {
    primary: `rgb(${this.whiteBase})`,
    secondary: `rgba(${this.whiteBase}, 0.65)`,
    disabled: `rgba(${this.whiteBase}, 0.61)`,
    link: palette.blueDarkText,
    maxContrast: palette.white,
  };

  primary = {
    main: palette.blueDarkMain,
    text: palette.blueDarkText,
    border: palette.blueDarkText,
  };

  secondary = {
    main: `rgba(${this.whiteBase}, 0.10)`,
    shade: `rgba(${this.whiteBase}, 0.14)`,
    transparent: `rgba(${this.whiteBase}, 0.08)`,
    text: this.text.primary,
    contrastText: `rgb(${this.whiteBase})`,
    border: `rgba(${this.whiteBase}, 0.08)`,
  };

  info = this.primary;

  error = {
    main: palette.redDarkMain,
    text: palette.redDarkText,
  };

  success = {
    main: palette.greenDarkMain,
    text: palette.greenDarkText,
  };

  warning = {
    main: palette.orangeDarkMain,
    text: palette.orangeDarkText,
  };

  background = {
    canvas: palette.gray05,
    primary: palette.gray10,
    secondary: palette.gray15,
    elevated: palette.gray15,
  };

  action = {
    hover: `rgba(${this.whiteBase}, 0.16)`,
    selected: `rgba(${this.whiteBase}, 0.12)`,
    selectedBorder: palette.orangeDarkMain,
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

  scrollbar = `rgba(${this.whiteBase}, 0.3)`;

  contrastThreshold = 3;
  hoverFactor = 0.03;
  tonalOffset = 0.15;
}

class LightColors implements ThemeColorsBase<Partial<ThemeRichColor>> {
  mode: ThemeColorsMode = 'light';

  blackBase = '36, 41, 46';

  primary = {
    main: palette.blueLightMain,
    border: palette.blueLightText,
    text: palette.blueLightText,
  };

  text = {
    primary: `rgba(${this.blackBase}, 1)`,
    secondary: `rgba(${this.blackBase}, 0.75)`,
    disabled: `rgba(${this.blackBase}, 0.65)`,
    link: this.primary.text,
    maxContrast: palette.black,
  };

  border = {
    weak: `rgba(${this.blackBase}, 0.12)`,
    medium: `rgba(${this.blackBase}, 0.3)`,
    strong: `rgba(${this.blackBase}, 0.4)`,
  };

  secondary = {
    main: `rgba(${this.blackBase}, 0.08)`,
    shade: `rgba(${this.blackBase}, 0.15)`,
    transparent: `rgba(${this.blackBase}, 0.08)`,
    contrastText: `rgba(${this.blackBase},  1)`,
    text: this.text.primary,
    border: this.border.weak,
  };

  info = {
    main: palette.blueLightMain,
    text: palette.blueLightText,
  };

  error = {
    main: palette.redLightMain,
    text: palette.redLightText,
    border: palette.redLightText,
  };

  success = {
    main: palette.greenLightMain,
    text: palette.greenLightText,
  };

  warning = {
    main: palette.orangeLightMain,
    text: palette.orangeLightText,
  };

  background = {
    canvas: palette.gray90,
    primary: palette.white,
    secondary: palette.gray100,
    elevated: palette.white,
  };

  action = {
    hover: `rgba(${this.blackBase}, 0.12)`,
    selected: `rgba(${this.blackBase}, 0.08)`,
    selectedBorder: palette.orangeLightMain,
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

  scrollbar = `rgba(${this.blackBase}, 0.3)`;

  contrastThreshold = 3;
  hoverFactor = 0.03;
  tonalOffset = 0.2;
}

export function createColors(colors: ThemeColorsInput): ThemeColors {
  const dark = new DarkColors();
  const light = new LightColors();
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
      color.main = base[name].main;
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
      color.transparent = alpha(color.main, 0.15);
    }
    if (!color.contrastText) {
      color.contrastText = getContrastText(color.main);
    }
    if (!color.borderTransparent) {
      color.borderTransparent = alpha(color.border, 0.25);
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

type RichColorNames = 'primary' | 'secondary' | 'info' | 'error' | 'success' | 'warning';

interface GetRichColorProps {
  color: Partial<ThemeRichColor>;
  name: RichColorNames;
}
