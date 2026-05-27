export interface ThemeTypographyVariant {
  fontSize: string;
  fontWeight: number;
  lineHeight: number;
  fontFamily: string;
  letterSpacing?: string;
}

export interface ThemeTypographyVariantTypes {
  h1: ThemeTypographyVariant;
  h2: ThemeTypographyVariant;
  h3: ThemeTypographyVariant;
  h4: ThemeTypographyVariant;
  h5: ThemeTypographyVariant;
  h6: ThemeTypographyVariant;
  body: ThemeTypographyVariant;
  bodySmall: ThemeTypographyVariant;
  code: ThemeTypographyVariant;
}

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
