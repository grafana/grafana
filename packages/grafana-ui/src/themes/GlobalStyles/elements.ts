import { css } from '@emotion/react';
import { GrafanaThemeV2, ThemeTypographyVariant } from '@grafana/data';

export function getVariantStyles(variant: ThemeTypographyVariant) {
  return `
    margin: 0;
    font-size: ${variant.fontSize};    
    line-height: ${variant.lineHeight};
    font-weight: ${variant.fontWeight};
    letter-spacing: ${variant.letterSpacing};
    font-family: ${variant.fontFamily};
    margin-bottom: 0.35em;
  `;
}

export function getElementStyles(theme: GrafanaThemeV2) {
  return css`
    h1,
    .h1 {
      ${getVariantStyles(theme.typography.h1)}
    }
    h2,
    .h2 {
      ${getVariantStyles(theme.typography.h2)}
    }
    h3,
    .h3 {
      ${getVariantStyles(theme.typography.h3)}
    }
    h4,
    .h4 {
      ${getVariantStyles(theme.typography.h4)}
    }
    h5,
    .h5 {
      ${getVariantStyles(theme.typography.h5)}
    }
    h6,
    .h6 {
      ${getVariantStyles(theme.typography.h6)}
    }
  `;
}
