import { css } from '@emotion/react';

import { GrafanaTheme2, ThemeTypographyVariant } from '@grafana/data';

import { getFocusStyles } from '../mixins';

export function getElementStyles(theme: GrafanaTheme2) {
  return css`
    html {
      -ms-overflow-style: scrollbar;
      -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
      height: 100%;
      font-size: ${theme.typography.htmlFontSize}px;
      font-family: ${theme.typography.fontFamily};
      line-height: ${theme.typography.body.lineHeight};
      font-kerning: normal;
    }

    :root {
      color-scheme: ${theme.colors.mode};
    }

    body {
      height: 100%;
      width: 100%;
      position: absolute;
      color: ${theme.colors.text.primary};
      background-color: ${theme.colors.background.canvas};
      ${getVariantStyles(theme.typography.body)}
    }

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

    p {
      margin: 0 0 ${theme.spacing(2)};
    }

    button {
      letter-spacing: ${theme.typography.body.letterSpacing};

      &:focus-visible {
        outline: ${getFocusStyles(theme)};
      }
      &:focus {
        outline: none;
      }
    }

    // Ex: 14px base font * 85% = about 12px
    small {
      font-size: ${theme.typography.bodySmall.fontSize};
    }

    b,
    strong {
      font-weight: ${theme.typography.fontWeightMedium};
    }

    em {
      font-style: italic;
      color: ${theme.colors.text.primary};
    }

    cite {
      font-style: normal;
    }

    // Utility classes
    .muted {
      color: ${theme.colors.text.secondary};
    }

    a.muted:hover,
    a.muted:focus {
      color: ${theme.colors.text.primary};
    }

    .text-warning {
      color: ${theme.colors.warning.text};

      &:hover,
      &:focus {
        color: ${theme.colors.emphasize(theme.colors.warning.text, 0.15)};
      }
    }

    .text-error {
      color: ${theme.colors.error.text};

      &:hover,
      &:focus {
        color: ${theme.colors.emphasize(theme.colors.error.text, 0.15)};
      }
    }

    .text-success {
      color: $success-text-color;

      &:hover,
      &:focus {
        color: ${theme.colors.emphasize(theme.colors.success.text, 0.15)};
      }
    }

    a {
      cursor: pointer;
      color: ${theme.colors.text.primary};
      text-decoration: none;

      &:focus {
        outline: none;
      }

      &:focus-visible {
        ${getFocusStyles(theme)}
      }

      &: [disabled] {
        cursor: default;
        pointer-events: none !important;
      }
    }

    .text-link {
      text-decoration: underline;
    }

    .text-left {
      text-align: left;
    }

    .text-right {
      text-align: right;
    }

    .text-center {
      text-align: center;
    }

    .highlight-search-match {
      background: ${theme.components.textHighlight.background};
      color: ${theme.components.textHighlight.text};
      padding: 0;
    }
  `;
}

export function getVariantStyles(variant: ThemeTypographyVariant) {
  return `
    margin: 0;
    font-size: ${variant.fontSize};
    line-height: ${variant.lineHeight};
    font-weight: ${variant.fontWeight};
    letter-spacing: ${variant.letterSpacing};
    font-family: ${variant.fontFamily};
    margin-bottom: 0.45em;
  `;
}
