import { z } from 'zod';

import { ThemeColorsInputSchema, ThemeVisualizationColorsInputSchema } from './color.mts';

/** @internal */
export const ThemeSpacingOptionsSchema = z.object({
  gridSize: z.int().positive().optional(),
});

/** @internal */
export type ThemeSpacingOptions = z.infer<typeof ThemeSpacingOptionsSchema>;

/** @internal */
export const ThemeShapeInputSchema = z.object({
  borderRadius: z.int().nonnegative().optional(),
});

/** @internal */
export type ThemeShapeInput = z.infer<typeof ThemeShapeInputSchema>;

/** @internal */
export const ThemeTypographyInputSchema = z.object({
  fontFamily: z.string().optional(),
  fontFamilyMonospace: z.string().optional(),
  fontSize: z.number().positive().optional(),
  fontWeightLight: z.number().positive().optional(),
  fontWeightRegular: z.number().positive().optional(),
  fontWeightMedium: z.number().positive().optional(),
  fontWeightBold: z.number().positive().optional(),
  // what's the font-size on the html element.
  // 16px is the default font-size used by browsers.
  htmlFontSize: z.number().positive().optional(),
});

/** @internal */
export type ThemeTypographyInput = z.infer<typeof ThemeTypographyInputSchema>;

/** @internal */
export const NewThemeOptionsSchema = z.object({
  name: z.string(),
  id: z.string(),
  colors: ThemeColorsInputSchema.optional(),
  spacing: ThemeSpacingOptionsSchema.optional(),
  shape: ThemeShapeInputSchema.optional(),
  typography: ThemeTypographyInputSchema.optional(),
  visualization: ThemeVisualizationColorsInputSchema.optional(),
});

/** @internal */
export type NewThemeOptions = z.infer<typeof NewThemeOptionsSchema>;
