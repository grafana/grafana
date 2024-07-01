import { css } from '@emotion/react';

import { GrafanaTheme2, ThemeTypographyVariant } from '@grafana/data';

import { getFocusStyles } from '../mixins';

export function getElementStyles(theme: GrafanaTheme2) {
  // TODO can we get the feature toggle in a better way?
  const isBodyScrolling = window.grafanaBootData?.settings.featureToggles.bodyScrolling;

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
      position: isBodyScrolling ? 'unset' : 'absolute',
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.background.canvas,
      overflowY: isBodyScrolling ? 'scroll' : 'visible',
      ...(isBodyScrolling && {
        '@media print': {
          overflow: 'visible',
        },
        '@page': {
          margin: 0,
          size: 'auto',
          padding: 0,
        },
      }),
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

    textarea: {
      overflow: 'auto',
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

    'audio, canvas, progress, video': {
      display: 'inline-block',
      verticalAlign: 'baseline',
    },

    // Prevent modern browsers from displaying `audio` without controls.
    // Remove excess height in iOS 5 devices.
    'audio:not([controls])': {
      display: 'none',
      height: 0,
    },

    // Address styling not present in Safari.
    'abbr[title]': {
      borderBottom: '1px dotted',
    },
    dfn: {
      fontStyle: 'italic',
    },

    // Prevent `sub` and `sup` affecting `line-height` in all browsers.
    'sub, sup': {
      fontSize: '75%',
      lineHeight: 0,
      position: 'relative',
      verticalAlign: 'baseline',
    },
    sup: {
      top: '-0.5em',
    },
    sub: {
      bottom: '-0.25em',
    },

    // 1. Correct color not being inherited.
    //    Known issue: affects color of disabled elements.
    // 2. Correct font properties not being inherited.
    // 3. Address margins set differently in Firefox 4+, Safari, and Chrome.
    'button, input, optgroup, select, textarea': {
      color: 'inherit',
      font: 'inherit',
      margin: 0,
    },

    // Don't inherit the `font-weight` (applied by a rule above).
    // NOTE: the default cannot safely be changed in Chrome and Safari on OS X.
    optgroup: {
      fontWeight: 'bold',
    },

    // 1. Avoid the WebKit bug in Android 4.0.* where (2) destroys native `audio`
    //    and `video` controls.
    // 2. Correct inability to style clickable `input` types in iOS.
    // 3. Improve usability and consistency of cursor style between image-type
    //    `input` and others.
    'button, html input[type="button"], input[type="submit"]': {
      WebkitAppearance: 'button',
      cursor: 'pointer',
    },

    // Remove inner padding and search cancel button in Safari and Chrome on OS X.
    // Safari (but not Chrome) clips the cancel button when the search input has
    // padding (and `textfield` appearance).
    'input[type="search"]::-webkit-search-cancel-button, input[type="search"]::-webkit-search-decoration': {
      WebkitAppearance: 'none',
    },

    table: {
      borderCollapse: 'collapse',
      borderSpacing: 0,
    },

    'td, th': {
      padding: 0,
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

export function getVariantStyles(variant: ThemeTypographyVariant) {
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
