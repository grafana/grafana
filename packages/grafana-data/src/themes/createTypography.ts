// Code based on Material UI
// The MIT License (MIT)
// Copyright (c) 2014 Call-Em-All
import * as z from 'zod';

import { type ThemeColors } from './createColors';

/** @beta */
export interface ThemeTypography extends ThemeTypographyVariantTypes {
  fontFamily: string;
  fontFamilyMonospace: string;
  fontSize: number;
  fontWeightLight: number;
  fontWeightRegular: number;
  fontWeightMedium: number;
  fontWeightBold: number;

  // The font-size on the html element.
  htmlFontSize?: number;

  /**
   * @deprecated
   * from legacy old theme
   * */
  size: {
    base: string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
  };

  pxToRem: (px: number) => string;
}

export interface ThemeTypographyVariant {
  fontSize: string;
  fontWeight: number;
  lineHeight: number;
  fontFamily: string;
  letterSpacing?: string;
}

// sizes are in px, matching the defaults passed to buildVariant
const ThemeTypographyVariantInputSchema = z
  .object({
    fontFamily: z.string(),
    fontWeight: z.number().positive(),
    fontSize: z.number().positive(),
    lineHeight: z.number().positive(),
    letterSpacing: z.number(),
  })
  .partial();

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
  xxl: ThemeTypographyVariantInputSchema.optional(),
  xl: ThemeTypographyVariantInputSchema.optional(),
  lg: ThemeTypographyVariantInputSchema.optional(),
  md: ThemeTypographyVariantInputSchema.optional(),
  base: ThemeTypographyVariantInputSchema.optional(),
  sm: ThemeTypographyVariantInputSchema.optional(),
  code: ThemeTypographyVariantInputSchema.optional(),
  h1: ThemeTypographyVariantInputSchema.optional(),
  h2: ThemeTypographyVariantInputSchema.optional(),
  h3: ThemeTypographyVariantInputSchema.optional(),
  h4: ThemeTypographyVariantInputSchema.optional(),
  h5: ThemeTypographyVariantInputSchema.optional(),
  h6: ThemeTypographyVariantInputSchema.optional(),
  body: ThemeTypographyVariantInputSchema.optional(),
  bodySmall: ThemeTypographyVariantInputSchema.optional(),
});

export type ThemeTypographyInput = z.infer<typeof ThemeTypographyInputSchema>;
type ThemeTypographyVariantInput = z.infer<typeof ThemeTypographyVariantInputSchema>;

const defaultFontFamily = "'Inter', 'Helvetica', 'Arial', sans-serif";
const defaultFontFamilyMonospace = "'Roboto Mono', monospace";

export function createTypography(colors: ThemeColors, typographyInput: ThemeTypographyInput = {}): ThemeTypography {
  const {
    fontFamily = defaultFontFamily,
    fontFamilyMonospace = defaultFontFamilyMonospace,
    // The default font size of the Material Specification.
    fontSize = 14, // px
    fontWeightLight = 300,
    fontWeightRegular = 400,
    fontWeightMedium = 500,
    fontWeightBold = 500,
    // Tell Grafana-UI what's the font-size on the html element.
    // 16px is the default font-size used by browsers.
    htmlFontSize = 14,
  } = typographyInput;

  if (process.env.NODE_ENV !== 'production') {
    if (typeof fontSize !== 'number') {
      console.error('Grafana-UI: `fontSize` is required to be a number.');
    }

    if (typeof htmlFontSize !== 'number') {
      console.error('Grafana-UI: `htmlFontSize` is required to be a number.');
    }
  }

  const coef = fontSize / 14;
  const pxToRem = (size: number) => `${(size / htmlFontSize) * coef}rem`;
  const buildVariant = (
    overrides: ThemeTypographyVariantInput | undefined,
    fontFamilyArg: string,
    fontWeightArg: number,
    fontSizeArg: number,
    lineHeightArg: number,
    letterSpacingArg: number
  ): ThemeTypographyVariant => {
    const fontFamily = overrides?.fontFamily ?? fontFamilyArg;
    const fontWeight = overrides?.fontWeight ?? fontWeightArg;
    const fontSize = overrides?.fontSize ?? fontSizeArg;
    const lineHeight = overrides?.lineHeight ?? lineHeightArg;
    const letterSpacing = overrides?.letterSpacing ?? letterSpacingArg;

    if (lineHeight % 2 !== 0 || fontSize % 2 !== 0) {
      throw new Error('Font size and line height should be integer multiples of 2 to prevent issues with alignment');
    }

    return {
      fontFamily,
      fontWeight,
      fontSize: pxToRem(fontSize),
      lineHeight: lineHeight / fontSize,
      letterSpacing: `${round(letterSpacing / fontSize)}em`,
    };
  };

  // All our fonts/line heights should be integer multiples of 2 to prevent issues with alignment
<<<<<<< HEAD
  const variants = {
    xxl: buildVariant(fontFamily, fontWeightRegular, 28, 32, -0.25),
    xl: buildVariant(fontFamily, fontWeightRegular, 24, 28, 0),
    lg: buildVariant(fontFamily, fontWeightRegular, 22, 24, 0),
    md: buildVariant(fontFamily, fontWeightRegular, 18, 22, 0.25),
    base: buildVariant(fontFamily, fontWeightRegular, fontSize, 22, 0.15),
    sm: buildVariant(fontFamily, fontWeightRegular, 12, 18, 0.15),
    code: buildVariant(fontFamilyMonospace, fontWeightRegular, 14, 16, 0.15),

    // Deprecated variants
    h1: buildVariant(fontFamily, fontWeightRegular, 28, 32, -0.25),
    h2: buildVariant(fontFamily, fontWeightRegular, 24, 28, 0),
    h3: buildVariant(fontFamily, fontWeightRegular, 22, 24, 0),
    h4: buildVariant(fontFamily, fontWeightRegular, 18, 22, 0.25),
    h5: buildVariant(fontFamily, fontWeightRegular, 16, 22, 0),
    h6: buildVariant(fontFamily, fontWeightMedium, 14, 22, 0.15),
    body: buildVariant(fontFamily, fontWeightRegular, fontSize, 22, 0.15),
    bodySmall: buildVariant(fontFamily, fontWeightRegular, 12, 18, 0.15),
=======
  const variants: ThemeTypographyVariantTypes = {
    xxl: buildVariant(typographyInput.xxl, fontFamily, fontWeightBold, 24, 34, 0.3),
    xl: buildVariant(typographyInput.xl, fontFamily, fontWeightBold, 22, 30, -0.2),
    lg: buildVariant(typographyInput.lg, fontFamily, fontWeightMedium, 20, 26, 0),
    md: buildVariant(typographyInput.md, fontFamily, fontWeightMedium, 16, 22, 0),
    base: buildVariant(typographyInput.base, fontFamily, fontWeightRegular, fontSize, 22, 0),
    sm: buildVariant(typographyInput.sm, fontFamily, fontWeightMedium, 12, 18, 0.2),
    code: buildVariant(typographyInput.code, fontFamilyMonospace, fontWeightRegular, 14, 16, 0.15),

    // Deprecated variants
    h1: buildVariant(typographyInput.h1, fontFamily, fontWeightRegular, 28, 32, -0.25),
    h2: buildVariant(typographyInput.h2, fontFamily, fontWeightRegular, 24, 28, 0),
    h3: buildVariant(typographyInput.h3, fontFamily, fontWeightRegular, 22, 24, 0),
    h4: buildVariant(typographyInput.h4, fontFamily, fontWeightRegular, 18, 22, 0.25),
    h5: buildVariant(typographyInput.h5, fontFamily, fontWeightRegular, 16, 22, 0),
    h6: buildVariant(typographyInput.h6, fontFamily, fontWeightMedium, 14, 22, 0.15),
    body: buildVariant(typographyInput.body, fontFamily, fontWeightRegular, fontSize, 22, 0.15),
    bodySmall: buildVariant(typographyInput.bodySmall, fontFamily, fontWeightRegular, 12, 18, 0.15),
>>>>>>> f88c3b30edf (override typography variants in visual_refresh themes)
  };

  const size = {
    base: '14px',
    xs: '10px',
    sm: '12px',
    md: '14px',
    lg: '18px',
  };

  return {
    htmlFontSize,
    pxToRem,
    fontFamily,
    fontFamilyMonospace,
    fontSize,
    fontWeightLight,
    fontWeightRegular,
    fontWeightMedium,
    fontWeightBold,
    size,
    ...variants,
  };
}

function round(value: number) {
  return Math.round(value * 1e5) / 1e5;
}

export interface ThemeTypographyVariantTypes {
  xxl: ThemeTypographyVariant;
  xl: ThemeTypographyVariant;
  lg: ThemeTypographyVariant;
  md: ThemeTypographyVariant;
  base: ThemeTypographyVariant;
  sm: ThemeTypographyVariant;
  code: ThemeTypographyVariant;

  /** @deprecated use `xxl` instead */
  h1: ThemeTypographyVariant;
  /** @deprecated use `xl` instead */
  h2: ThemeTypographyVariant;
  /** @deprecated use `lg` instead */
  h3: ThemeTypographyVariant;
  /** @deprecated use `md` instead */
  h4: ThemeTypographyVariant;
  /** @deprecated use `base` instead */
  h5: ThemeTypographyVariant;
  /** @deprecated use `sm` instead */
  h6: ThemeTypographyVariant;
  /** @deprecated use `base` instead */
  body: ThemeTypographyVariant;
  /** @deprecated use `sm` instead */
  bodySmall: ThemeTypographyVariant;
}
