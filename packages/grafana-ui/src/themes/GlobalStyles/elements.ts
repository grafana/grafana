import { css, CSSObject } from '@emotion/react';

import { GrafanaTheme2, ThemeTypographyVariant } from '@grafana/data';

import { getFocusStyles } from '../mixins';

export function getElementStyles(theme: GrafanaTheme2) {
  return css({
    html: {
      MsOverflowStyle: 'scrollbar',
      WebkitTapHighlightColor: 'rgba(0, 0, 0, 0)',
      height: '100%',
      fontSize: `${theme.typography.htmlFontSize}px`,
      fontFamily: theme.typography.fontFamily,
      lineHeight: theme.typography.body.lineHeight,
      fontKerning: 'normal',
    },

    ':root': {
      colorScheme: theme.colors.mode,
    },

    body: {
      height: '100%',
      width: '100%',
      position: 'absolute',
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.background.canvas,
      ...getVariantStyles(theme.typography.body),
    },

    'h1, .h1': getVariantStyles(theme.typography.h1),
    'h2, .h2': getVariantStyles(theme.typography.h2),
    'h3, .h3': getVariantStyles(theme.typography.h3),
    'h4, .h4': getVariantStyles(theme.typography.h4),
    'h5, .h5': getVariantStyles(theme.typography.h5),
    'h6, .h6': getVariantStyles(theme.typography.h6),

    p: {
      margin: theme.spacing(0, 0, 2),
    },

    button: {
      letterSpacing: theme.typography.body.letterSpacing,

      '&:focus-visible': getFocusStyles(theme),
      '&:focus': {
        outline: 'none',
      },
    },

    // Ex: 14px base font * 85% = about 12px
    small: {
      fontSize: theme.typography.bodySmall.fontSize,
    },

    'b, strong': {
      fontWeight: theme.typography.fontWeightMedium,
    },

    em: {
      fontStyle: 'italic',
      color: theme.colors.text.primary,
    },

    cite: {
      fontStyle: 'normal',
    },

    // Utility classes
    '.muted': {
      color: theme.colors.text.secondary,
    },

    'a.muted:hover, a.muted:focus': {
      color: theme.colors.text.primary,
    },

    '.text-warning': {
      color: theme.colors.warning.text,

      '&:hover, &:focus': {
        color: theme.colors.emphasize(theme.colors.warning.text, 0.15),
      },
    },

    '.text-error': {
      color: theme.colors.error.text,

      '&:hover, &:focus': {
        color: theme.colors.emphasize(theme.colors.error.text, 0.15),
      },
    },

    '.text-success': {
      color: '$success-text-color',

      '&:hover, &:focus': {
        color: theme.colors.emphasize(theme.colors.success.text, 0.15),
      },
    },

    a: {
      cursor: 'pointer',
      color: theme.colors.text.primary,
      textDecoration: 'none',

      '&:focus': {
        outline: 'none',
      },

      '&:focus-visible': getFocusStyles(theme),

      '&:[disabled]': {
        cursor: 'default',
        // Need type assertion here due to the use of !important
        // see https://github.com/frenic/csstype/issues/114#issuecomment-697201978
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        pointerEvents: 'none !important' as 'none',
      },
    },

    '.text-link': {
      textDecoration: 'underline',
    },

    '.text-left': {
      textAlign: 'left',
    },

    '.text-right': {
      textAlign: 'right',
    },

    '.text-center': {
      textAlign: 'center',
    },

    '.highlight-search-match': {
      background: theme.components.textHighlight.background,
      color: theme.components.textHighlight.text,
      padding: 0,
    },
  });
}

export function getVariantStyles(variant: ThemeTypographyVariant): CSSObject {
  return {
    margin: 0,
    fontSize: variant.fontSize,
    lineHeight: variant.lineHeight,
    fontWeight: variant.fontWeight,
    letterSpacing: variant.letterSpacing,
    fontFamily: variant.fontFamily,
    marginBottom: '0.45em',
  };
}
