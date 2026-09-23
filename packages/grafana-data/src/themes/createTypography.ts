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

export type ThemeTypographyInput = z.infer<typeof ThemeTypographyInputSchema>;

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
    fontFamily: string,
    fontWeight: number,
    size: number,
    lineHeight: number,
    letterSpacing: number,
    casing?: object
  ): ThemeTypographyVariant => {
    if (lineHeight % 2 !== 0 || size % 2 !== 0) {
      throw new Error('Font size and line height should be integer multiples of 2 to prevent issues with alignment');
    }

    return {
      fontFamily,
      fontWeight,
      fontSize: pxToRem(size),
      lineHeight: lineHeight / size,
      ...(fontFamily === defaultFontFamily ? { letterSpacing: `${round(letterSpacing / size)}em` } : {}),
      ...casing,
    };
  };

  // All our fonts/line heights should be integer multiples of 2 to prevent issues with alignment
  const variants = {
    xxl: buildVariant(fontFamily, fontWeightBold, 24, 34, -0.3),
    xl: buildVariant(fontFamily, fontWeightBold, 22, 30, -0.2),
    lg: buildVariant(fontFamily, fontWeightMedium, 20, 26, 0),
    md: buildVariant(fontFamily, fontWeightMedium, 16, 22, 0),
    base: buildVariant(fontFamily, fontWeightRegular, fontSize, 22, 0),
    sm: buildVariant(fontFamily, fontWeightMedium, 12, 18, 0.2),
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
