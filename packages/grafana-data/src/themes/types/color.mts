import { z } from 'zod';
import { type DeepRequired } from '../types.ts';

export const ThemeRichColorInputSchema = z.object({
  /** color intent (primary, secondary, info, error, etc) */
  name: z.string().optional(),
  /** Main color */
  main: z.string().optional(),
  /** Used for hover */
  shade: z.string().optional(),
  /** Used for text */
  text: z.string().optional(),
  /** Used for borders */
  border: z.string().optional(),
  /** Used subtly colored backgrounds */
  transparent: z.string().optional(),
  /** Used for weak colored borders like larger alert/banner boxes and smaller badges and tags */
  borderTransparent: z.string().optional(),
  /** Text color for text ontop of main */
  contrastText: z.string().optional(),
});

const ThemeRichColorSchema = ThemeRichColorInputSchema.required();

export type ThemeRichColor = z.infer<typeof ThemeRichColorSchema>;

/**
 * @alpha
 */
export interface ThemeVisualizationColors {
  /** Only for internal use by color schemes */
  palette: string[];
  /** Lookup the real color given the name */
  getColorByName: (color: string) => string;
  /** Colors organized by hue */
  hues: ThemeVizHue[];
}

//
// vizualization
//

export type ThemeVizColorName = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';

const createShadeSchema = <T,>(color: T extends ThemeVizColorName ? T : never) =>
  z.enum([`super-light-${color}`, `light-${color}`, color, `semi-dark-${color}`, `dark-${color}`]);

export type ThemeVizColorShadeName<T extends ThemeVizColorName> = z.infer<ReturnType<typeof createShadeSchema<T>>>;

const createHueSchema = <T,>(color: T extends ThemeVizColorName ? T : never) =>
  z.object({
    name: z.literal(color),
    shades: z.array(
      z.object({
        color: z.string(),
        name: createShadeSchema(color),
        aliases: z.array(z.string()).optional(),
        primary: z.boolean().optional(),
      })
    ),
  });

const ThemeVizHueSchema = z.union([
  createHueSchema('red'),
  createHueSchema('orange'),
  createHueSchema('yellow'),
  createHueSchema('green'),
  createHueSchema('blue'),
  createHueSchema('purple'),
]);

export type ThemeVizHue = z.infer<typeof ThemeVizHueSchema>;

export const ThemeVisualizationColorsInputSchema = z.object({
  hues: z.array(ThemeVizHueSchema).optional(),
  palette: z.array(z.string()).optional(),
});

export type ThemeVisualizationColorsInput = z.infer<typeof ThemeVisualizationColorsInputSchema>;

//
// theme colors
//

const ThemeColorsModeSchema = z.enum(['light', 'dark']);

/** @internal */
export type ThemeColorsMode = z.infer<typeof ThemeColorsModeSchema>;

export const createThemeColorsBaseSchema = <TColor,>(color: TColor) =>
  z
    .object({
      mode: ThemeColorsModeSchema,

      primary: color,
      secondary: color,
      tertiary: color,
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

export const ThemeColorsInputSchema = createThemeColorsBaseSchema(ThemeRichColorInputSchema);

/** @internal */
export type ThemeColorsInput = z.infer<typeof ThemeColorsInputSchema>;

// Need to override the zod type to include the generic properly
/** @internal */
export type ThemeColorsBase<TColor> = DeepRequired<
  Omit<
    z.infer<ReturnType<typeof createThemeColorsBaseSchema>>,
    'primary' | 'secondary' | 'tertiary' | 'info' | 'error' | 'success' | 'warning'
  >
> & {
  primary: TColor;
  secondary: TColor;
  tertiary: TColor;
  info: TColor;
  error: TColor;
  success: TColor;
  warning: TColor;
};

/** @beta */
export interface ThemeColors extends ThemeColorsBase<ThemeRichColor> {
  /** Returns a text color for the background */
  getContrastText(background: string, threshold?: number): string;
  /* Brighten or darken a color by specified factor (0-1) */
  emphasize(color: string, amount?: number): string;
}
