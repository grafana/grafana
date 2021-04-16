// Code based on Material UI
// The MIT License (MIT)
// Copyright (c) 2014 Call-Em-All

import { ThemePalette } from './createPalette';

/** @beta */
export interface ThemeTypography {
  fontFamily: string;
  fontFamilyMonospace: string;
  fontSize: number;
  fontWeightLight: number;
  fontWeightRegular: number;
  fontWeightMedium: number;
  fontWeightBold: number;

  // The font-size on the html element.
  htmlFontSize?: number;

  h1: ThemeTypographyVariant;
  h2: ThemeTypographyVariant;
  h3: ThemeTypographyVariant;
  h4: ThemeTypographyVariant;
  h5: ThemeTypographyVariant;
  h6: ThemeTypographyVariant;

  body: ThemeTypographyVariant;
  bodySmall: ThemeTypographyVariant;

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

export interface ThemeTypographyInput {
  fontFamily?: string;
  fontFamilyMonospace?: string;
  fontSize?: number;
  fontWeightLight?: number;
  fontWeightRegular?: number;
  fontWeightMedium?: number;
  fontWeightBold?: number;
  // hat's the font-size on the html element.
  // 16px is the default font-size used by browsers.
  htmlFontSize?: number;
}

const defaultFontFamily = '"Inter", "Helvetica", "Arial", sans-serif';
const defaultFontFamilyMonospace = "'Roboto Mono', monospace";

export function createTypography(palette: ThemePalette, typographyInput: ThemeTypographyInput = {}): ThemeTypography {
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
    fontWeight: number,
    size: number,
    lineHeight: number,
    letterSpacing: number,
    casing?: object
  ): ThemeTypographyVariant => ({
    fontFamily,
    fontWeight,
    fontSize: pxToRem(size),
    lineHeight,
    letterSpacing: `${letterSpacing}em`,
    ...casing,
  });

  const variants = {
    h1: buildVariant(fontWeightMedium, 28, 1.2, -0.01),
    h2: buildVariant(fontWeightMedium, 24, 1.2, -0.01),
    h3: buildVariant(fontWeightMedium, 21, 1.3, -0.01),
    h4: buildVariant(fontWeightRegular, 18, 1.4, -0.005),
    h5: buildVariant(fontWeightRegular, 16, 1.334, -0.005),
    h6: buildVariant(fontWeightRegular, 14, 1.6, -0.005),
    body: buildVariant(fontWeightRegular, 14, 1.5, -0.005),
    bodySmall: buildVariant(fontWeightRegular, 12, 1.5, -0.005),
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
