import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getFormElementStyles(theme: GrafanaTheme2) {
  return css({
    'input, button, select, textarea': {
      fontFamily: theme.typography.body.fontFamily,
      fontSize: theme.typography.body.fontSize,
      fontWeight: theme.typography.body.fontWeight,
      lineHeight: theme.typography.body.lineHeight,
    },

    'input, select': {
      backgroundColor: theme.components.input.background,
      color: theme.components.input.text,
      border: 'none',
      boxShadow: 'none',
    },

    // Placeholder text gets special styles because when browsers invalidate entire lines if it doesn't understand a selector
    'input, textarea': {
      '&::placeholder': {
        color: theme.colors.text.disabled,
      },
    },

    // not a big fan of number fields
    'input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button': {
      WebkitAppearance: 'none',
      margin: 0,
    },
    'input[type="number"]': {
      MozAppearance: 'textfield',
    },

    // Set the height of select and file controls to match text inputs
    'select, input[type="file"]': {
      height:
        theme.components.height
          .md /* In IE7, the height of the select element cannot be changed by height, only font-size */,
      lineHeight: theme.components.height.md,
    },

    // Make select elements obey height by applying a border
    select: {
      width: '220px', // default input width + 10px of padding that doesn't get applied
      border: `1px solid ${theme.components.input.borderColor}`,
      backgroundColor: theme.components.input.background, // Chrome on Linux and Mobile Safari need background-color
    },

    'select[multiple], select[size], textarea': {
      height: 'auto',
    },

    // Focus for select, file, radio, and checkbox
    'select:focus, input[type="file"]:focus, input[type="radio"]:focus, input[type="checkbox"]:focus': {
      // WebKit
      outline: '5px auto -webkit-focus-ring-color',
      outlineOffset: '-2px',
    },

    // Reset width of input images, buttons, radios, checkboxes
    "input[type='file'], input[type='image'], input[type='submit'], input[type='reset'], input[type='button'], input[type='radio'], input[type='checkbox']":
      {
        width: 'auto', // Override of generic input selector
      },

    // Disabled and read-only inputs
    'input[disabled], select[disabled], textarea[disabled], input[readonly], select[readonly], textarea[readonly]': {
      cursor: 'not-allowed',
      backgroundColor: theme.colors.action.disabledBackground,
    },

    // Explicitly reset the colors here
    'input[type="radio"][disabled], input[type="checkbox"][disabled], input[type="radio"][readonly], input[type="checkbox"][readonly]':
      {
        cursor: 'not-allowed',
        backgroundColor: 'transparent',
      },

    'input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill, textarea:-webkit-autofill, textarea:-webkit-autofill:hover, textarea:-webkit-autofill:focus, select:-webkit-autofill, select:-webkit-autofill:hover, select:-webkit-autofill:focus':
      {
        WebkitBoxShadow: `0 0 0px 1000px ${theme.components.input.background} inset !important`,
        WebkitTextFillColor: theme.components.input.text,
        boxShadow: `0 0 0px 1000px ${theme.components.input.background} inset`,
        border: `1px solid ${theme.components.input.background}`,
      },

    '.gf-form': {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      textAlign: 'left',
      position: 'relative',
      marginBottom: theme.spacing(0.5),

      '&--offset-1': {
        marginLeft: theme.spacing(2),
      },

      '&--grow': {
        flexGrow: 1,
      },

      '&--flex-end': {
        justifyContent: 'flex-end',
      },

      '&--align-center': {
        alignContent: 'center',
      },

      '&--alt': {
        flexDirection: 'column',
        alignItems: 'flex-start',

        '.gf-form-label': {
          padding: '4px 0',
        },
      },
    },
    '.gf-form--has-input-icon': {
      position: 'relative',
      marginRight: theme.spacing(0.5),

      '.gf-form-input-icon': {
        position: 'absolute',
        top: '8px',
        fontSize: theme.typography.size.lg,
        left: '10px',
        color: theme.colors.text.disabled,
      },

      '> input': {
        paddingLeft: '35px',

        '&:focus + .gf-form-input-icon': {
          color: theme.colors.text.secondary,
        },
      },

      '.Select--multi .Select-multi-value-wrapper, .Select-placeholder': {
        paddingLeft: '30px',
      },
    },

    '.gf-form-disabled': {
      color: theme.colors.text.secondary,

      '.gf-form-select-wrapper::after': {
        color: theme.colors.text.secondary,
      },

      'a, .gf-form-input': {
        color: theme.colors.text.secondary,
      },
    },

    '.gf-form-group': {
      marginBottom: theme.spacing(5),
    },
    '.gf-form-inline': {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContent: 'flex-start',

      '&--nowrap': {
        flexWrap: 'nowrap',
      },

      '&--xs-view-flex-column': {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        [theme.breakpoints.down('sm')]: {
          flexDirection: 'column',
        },
      },

      '.select-container': {
        marginRight: theme.spacing(0.5),
      },

      '.gf-form-spacing': {
        marginRight: theme.spacing(0.5),
      },
    },

    '.gf-form-button-row': {
      paddingTop: theme.spacing(3),
      'a, button': {
        marginRight: theme.spacing(2),
      },
    },
    '.gf-form-label': {
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(0, 1),
      flexShrink: 0,
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.size.sm,
      backgroundColor: theme.colors.background.secondary,
      height: '32px',
      lineHeight: '32px',
      marginRight: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      justifyContent: 'space-between',
      border: 'none',

      '&--grow': {
        flexGrow: 1,
      },

      '&--transparent': {
        backgroundColor: 'transparent',
        border: 0,
        textAlign: 'right',
        paddingLeft: 0,
      },

      '&--variable': {
        color: theme.colors.primary.text,
        background: theme.components.panel.background,
        border: `1px solid ${theme.components.panel.borderColor}`,
      },

      '&--btn': {
        border: 'none',
        borderRadius: theme.shape.radius.default,
        '&:hover': {
          background: theme.colors.background.secondary,
          color: theme.colors.text.primary,
        },
      },

      '&:disabled': {
        color: theme.colors.text.secondary,
      },
    },
    '.gf-form-label + .gf-form-label': {
      marginRight: theme.spacing(0.5),
    },
    '.gf-form-pre': {
      display: 'block !important',
      flexGrow: 1,
      margin: 0,
      marginRight: theme.spacing(0.5),
      border: `1px solid transparent`,
      borderLeft: 'none',
      borderRadius: theme.shape.radius.default,
    },
    '.gf-form-textarea': {
      maxWidth: '650px',
    },
    '.gf-form-input': {
      display: 'block',
      width: '100%',
      height: '32px',
      padding: theme.spacing(0, 1),
      fontSize: theme.typography.size.md,
      lineHeight: '18px',
      color: theme.components.input.text,
      backgroundColor: theme.components.input.background,
      backgroundImage: 'none',
      backgroundClip: 'padding-box',
      border: `1px solid ${theme.components.input.borderColor}`,
      borderRadius: theme.shape.radius.default,
      marginRight: theme.spacing(0.5),
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',

      // text areas should be scrollable
      '&textarea': {
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        padding: `6px ${theme.spacing(1)}`,
        minHeight: '32px',
        height: 'auto',
      },

      // Unstyle the caret on `<select>`s in IE10+.
      '&::-ms-expand': {
        backgroundColor: 'transparent',
        border: 0,
        display: 'none',
      },

      // Customize the `:focus` state to imitate native WebKit styles.
      '&:focus': {
        borderColor: theme.colors.primary.border,
        outline: 'none',
      },

      // Placeholder
      '&::placeholder': {
        color: theme.colors.text.disabled,
        opacity: 1,
      },

      '&:disabled, &[readonly]': {
        backgroundColor: theme.colors.action.disabledBackground,
        // iOS fix for unreadable disabled content; see https://github.com/twbs/bootstrap/issues/11655.
        opacity: 1,
      },

      '&:disabled': {
        cursor: 'not-allowed',
      },

      '&.gf-size-auto': {
        width: 'auto',
      },

      '&--dropdown': {
        paddingRight: theme.spacing(3),
        position: 'relative',
        display: 'flex',
        alignItems: 'center',

        '&::after': {
          position: 'absolute',
          top: '36%',
          right: '11px',
          fontSize: '11px',
          backgroundColor: 'transparent',
          color: theme.colors.text.primary,
          font: `normal normal normal ${theme.typography.size.sm}/1 FontAwesome`,
          content: '"\f0d7"',
          pointerEvents: 'none',
        },
      },

      '&--has-help-icon': {
        paddingRight: theme.spacing(4),
      },
    },
    '.gf-form-select-wrapper': {
      position: 'relative',
      backgroundColor: theme.components.input.background,
      marginRight: theme.spacing(0.5),

      '.gf-form-select-icon': {
        position: 'absolute',
        zIndex: 1,
        top: '50%',
        marginTop: '-7px',

        '+ .gf-form-input': {
          position: 'relative',
          zIndex: 2,
          paddingLeft: theme.spacing(4),
          backgroundColor: 'transparent',

          option: {
            // Firefox
            color: theme.v1.palette.black,
          },
        },
      },

      '.gf-form-input': {
        marginRight: 0,
        lineHeight: '32px',
      },

      'select.gf-form-input': {
        textIndent: '0.01px',
        textOverflow: "''",
        paddingRight: theme.spacing(4),
        appearance: 'none',

        '&:-moz-focusring': {
          outline: 'none',
          color: 'transparent',
          textShadow: `0 0 0 ${theme.colors.text.primary}`,
        },

        '&.ng-empty': {
          color: theme.colors.text.secondary,
        },
      },

      '&::after': {
        position: 'absolute',
        top: '36%',
        right: '11px',
        backgroundColor: 'transparent',
        color: theme.colors.text.primary,
        font: `normal normal normal ${theme.typography.size.sm}/1 FontAwesome`,
        content: '"\f0d7"',
        pointerEvents: 'none',
        fontSize: '11px',
      },

      '&--has-help-icon': {
        '&::after': {
          right: theme.spacing(4),
        },
      },
    },
    '.gf-form--v-stretch': {
      alignItems: 'stretch',
    },

    '.gf-form-btn': {
      padding: theme.spacing(0, 1),
      marginRight: theme.spacing(0.5),
      lineHeight: '18px',
      fontSize: theme.typography.size.sm,
      flexShrink: 0,
      flexGrow: 0,
    },
    '.gf-form-help-icon': {
      flexGrow: 0,
      color: theme.colors.text.secondary,

      '&:hover': {
        color: theme.colors.text.primary,
      },
    },
    '.cta-form': {
      position: 'relative',
      padding: theme.spacing(3),
      backgroundColor: theme.colors.background.secondary,
      marginBottom: theme.spacing(3),
      borderTop: `3px solid ${theme.colors.success.main}`,
    },
    '.input-small': {
      width: '90px',
    },
  });
}
