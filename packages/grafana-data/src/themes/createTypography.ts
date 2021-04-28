// Code based on Material UI
// The MIT License (MIT)
// Copyright (c) 2014 Call-Em-All

import { ThemeColors } from './createColors';

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

const defaultFontFamily = '"Roboto", "Helvetica", "Arial", sans-serif';
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
    ...(fontFamily === defaultFontFamily ? { letterSpacing: `${round(letterSpacing / size)}em` } : {}),
    ...casing,
  });

  const variants = {
    h1: buildVariant(fontWeightLight, 28, 1.167, -0.25),
    h2: buildVariant(fontWeightLight, 24, 1.2, 0),
    h3: buildVariant(fontWeightRegular, 21, 1.167, 0),
    h4: buildVariant(fontWeightRegular, 18, 1.235, 0.25),
    h5: buildVariant(fontWeightRegular, 16, 1.334, 0),
    h6: buildVariant(fontWeightMedium, 14, 1.6, 0.15),
    body: buildVariant(fontWeightRegular, 14, 1.5, 0.15),
    bodySmall: buildVariant(fontWeightRegular, 12, 1.5, 0.15),
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
