// Code based on Material UI
// The MIT License (MIT)
// Copyright (c) 2014 Call-Em-All

import { ThemePalette } from './createPalette';

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
const defaultFontFamilyMonospace = "Menlo, Monaco, Consolas, 'Courier New', monospace";

export function createTypography(palette: ThemePalette, typographyInput: ThemeTypographyInput = {}) {
  const {
    fontFamily = defaultFontFamily,
    fontFamilyMonospace = defaultFontFamilyMonospace,
    // The default font size of the Material Specification.
    fontSize = 14, // px
    fontWeightLight = 300,
    fontWeightRegular = 400,
    fontWeightMedium = 500,
    fontWeightBold = 700,
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
    // Unitless following https://meyerweb.com/eric/thoughts/2006/02/08/unitless-line-heights/
    lineHeight,
    // The letter spacing was designed for the Roboto font-family. Using the same letter-spacing
    // across font-families can cause issues with the kerning.
    ...(fontFamily === defaultFontFamily ? { letterSpacing: `${round(letterSpacing / size)}em` } : {}),
    ...casing,
  });

  const variants = {
    h1: buildVariant(fontWeightLight, 96, 1.167, -1.5),
    h2: buildVariant(fontWeightLight, 60, 1.2, -0.5),
    h3: buildVariant(fontWeightRegular, 48, 1.167, 0),
    h4: buildVariant(fontWeightRegular, 34, 1.235, 0.25),
    h5: buildVariant(fontWeightRegular, 24, 1.334, 0),
    h6: buildVariant(fontWeightMedium, 20, 1.6, 0.15),
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
    ...variants,
  };
}

function round(value: number) {
  return Math.round(value * 1e5) / 1e5;
}
