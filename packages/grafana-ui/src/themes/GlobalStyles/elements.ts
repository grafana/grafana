import { css } from '@emotion/react';

import { GrafanaTheme2, ThemeTypographyVariant } from '@grafana/data';

import { getFeatureToggle } from '../../utils/featureToggle';
import { getFocusStyles } from '../mixins';

export function getElementStyles(theme: GrafanaTheme2, isExtensionSidebarOpen?: boolean) {
  // in case the sidebar is closed, we want the body to scroll
  // react select tries prevent scrolling by setting overflow/padding-right on the body
  // Need type assertion here due to the use of !important
  // see https://github.com/frenic/csstype/issues/114#issuecomment-697201978
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const bodyOverflow = isExtensionSidebarOpen ? {} : { overflowY: 'auto !important' as 'auto' };
  return css({
    '*, *::before, *::after': {
      boxSizing: 'inherit',
    },

    // Suppress the focus outline on elements that cannot be accessed via keyboard.
    // This prevents an unwanted focus outline from appearing around elements that
    // might still respond to pointer events.
    //
    // Credit: https://github.com/suitcss/base
    "[tabindex='-1']:focus": {
      outline: 'none !important',
    },

    html: {
      MsOverflowStyle: 'scrollbar',
      WebkitTapHighlightColor: 'rgba(0, 0, 0, 0)',
      boxSizing: 'border-box',
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
      position: 'unset',
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.background.canvas,
      paddingRight: '0 !important',
      '@media print': {
        overflow: 'visible',
      },
      '@page': {
        margin: 0,
        size: 'auto',
        padding: 0,
      },
      // disable contextual font ligatures. otherwise, in firefox and safari,
      // an "x" between 2 numbers is replaced by a multiplication ligature
      // see https://github.com/rsms/inter/issues/222
      fontVariantLigatures: 'no-contextual',
      ...theme.typography.body,
      ...bodyOverflow,
      fontVariantNumeric: getFeatureToggle('tabularNumbers') ? 'tabular-nums' : 'initial',
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
      // Textareas should really only resize vertically so they don't break their (horizontal) containers.
      resize: 'vertical',
    },

    button: {
      letterSpacing: theme.typography.body.letterSpacing,

      '&:focus-visible': getFocusStyles(theme),
      '&:focus': {
        outline: 'none',
      },
    },

    label: {
      // Allow labels to use `margin` for spacing.
      display: 'inline-block',
    },

    figure: {
      margin: theme.spacing(0, 0, 2),
    },

    img: {
      // By default, `<img>`s are `inline-block`. This assumes that, and vertically
      // centers them. This won't apply should you reset them to `block` level.
      verticalAlign: 'middle',
      // Note: `<img>`s are deliberately not made responsive by default.
      // For the rationale behind this, see the comments on the `.img-fluid` class.
    },

    fieldset: {
      // Chrome and Firefox set a `min-width: min-content;` on fieldsets,
      // so we reset that to ensure it behaves more like a standard block element.
      // See https://github.com/twbs/bootstrap/issues/12359.
      minWidth: 0,
      // Reset the default outline behavior of fieldsets so they don't affect page layout.
      padding: 0,
      margin: 0,
      border: 0,
    },

    legend: {
      // Reset the entire legend element to match the `fieldset`
      display: 'block',
      width: '100%',
      padding: 0,
      marginBottom: theme.spacing(1),
      fontSize: theme.spacing(3),
      lineHeight: 'inherit',
      border: 0,
    },

    // Ex: 14px base font * 85% = about 12px
    'small, .small': {
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: 'normal',
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

    blockquote: {
      padding: theme.spacing(0, 0, 0, 2),
      margin: theme.spacing(0, 0, 2),
      borderLeft: `5px solid ${theme.v1.palette.gray3}`,
      p: {
        marginBottom: 0,
        fontSize: theme.typography.fontSize * 1.25,
        fontWeight: 300,
        lineHeight: 1.25,
      },
      small: {
        display: 'block',
        lineHeight: theme.typography.body.lineHeight,
        color: theme.v1.palette.gray2,
        '&:before': {
          content: "'\\2014 \\00A0'",
        },
      },
    },

    // Quotes
    'q:before, q:after, blockquote:before, blockquote:after': {
      content: "''",
    },

    // Addresses
    address: {
      display: 'block',
      marginBottom: theme.spacing(2),
      fontStyle: 'normal',
      lineHeight: theme.typography.body.lineHeight,
    },

    'a.external-link': {
      color: theme.colors.text.link,
      textDecoration: 'normal',

      '&:hover': {
        color: theme.colors.text.link,
        textDecoration: 'underline',
      },
    },

    '.link': {
      color: theme.colors.text.primary,
      cursor: 'pointer',
    },

    '.link:hover': {
      color: theme.colors.text.maxContrast,
    },

    '.pointer': {
      cursor: 'pointer',
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
      cursor: 'help',
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

    hr: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
      border: 0,
      borderTop: `1px solid ${theme.colors.border.medium}`,
    },

    'mark, .mark': {
      background: theme.colors.warning.main,
    },

    'ul, ol, dl': {
      marginTop: 0,
      marginBottom: 0,
      padding: 0,
    },
    'ul ul, ul ol, ol ol, ol ul': {
      marginBottom: 0,
    },
    li: {
      lineHeight: theme.typography.body.lineHeight,
    },
    dd: {
      marginBottom: theme.spacing(1),
      marginLeft: 0, // Undo browser default
    },
    'dt, dd': {
      lineHeight: theme.typography.body.lineHeight,
    },
    dt: {
      fontWeight: theme.typography.fontWeightMedium,
    },

    // 1. Correct color not being inherited.
    //    Known issue: affects color of disabled elements.
    // 2. Correct font properties not being inherited.
    // 3. Address margins set differently in Firefox 4+, Safari, and Chrome.
    'button, input, optgroup, select, textarea': {
      // eslint-disable-next-line @grafana/no-border-radius-literal
      borderRadius: 0,
      color: 'inherit',
      font: 'inherit',
      lineHeight: 'inherit',
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

    'input[type="search"]': {
      // This overrides the extra rounded corners on search inputs in iOS so that our
      // `.form-control` class can properly style them. Note that this cannot simply
      // be added to `.form-control` as it's not specific enough. For details, see
      // https://github.com/twbs/bootstrap/issues/11586.
      WebkitAppearance: 'none',
    },

    // Remove inner padding and search cancel button in Safari and Chrome on OS X.
    // Safari (but not Chrome) clips the cancel button when the search input has
    // padding (and `textfield` appearance).
    'input[type="search"]::-webkit-search-cancel-button, input[type="search"]::-webkit-search-decoration': {
      WebkitAppearance: 'none',
    },

    table: {
      // Reset for nesting within parents with `background-color`.
      backgroundColor: 'transparent',
      borderCollapse: 'collapse',
      borderSpacing: 0,
    },

    caption: {
      paddingTop: theme.spacing(0.5),
      paddingBottom: theme.spacing(0.5),
      color: theme.colors.text.secondary,
      textAlign: 'left',
      captionSide: 'bottom',
    },

    th: {
      fontWeight: theme.typography.fontWeightMedium,
      textAlign: 'left',
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

    // iOS "clickable elements" fix for role="button"
    //
    // Fixes "clickability" issue (and more generally, the firing of events such as focus as well)
    // for traditionally non-focusable elements with role="button"
    // see https://developer.mozilla.org/en-US/docs/Web/Events/click#Safari_Mobile
    "[role='button']": {
      cursor: 'pointer',
    },

    // Always hide an element with the `hidden` HTML attribute (from PureCSS).
    '[hidden]': {
      display: 'none !important',
    },

    // Avoid 300ms click delay on touch devices that support the `touch-action` CSS property.
    //
    // In particular, unlike most other browsers, IE11+Edge on Windows 10 on touch devices and IE Mobile 10-11
    // DON'T remove the click delay when `<meta name="viewport" content="width=device-width">` is present.
    // However, they DO support removing the click delay via `touch-action: manipulation`.
    // See:
    // * http://v4-alpha.getbootstrap.com/content/reboot/#click-delay-optimization-for-touch
    // * http://caniuse.com/#feat=css-touch-action
    // * http://patrickhlauke.github.io/touch/tests/results/#suppressing-300ms-delay
    "a, area, button, [role='button'], input, label, select, summary, textarea": {
      touchAction: 'manipulation',
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

    '.template-variable': {
      color: theme.colors.primary.text,
    },

    '.modal-header-title': {
      fontSize: theme.typography.size.lg,
      float: 'left',
      paddingTop: theme.spacing(1),
      margin: theme.spacing(0, 2),
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
