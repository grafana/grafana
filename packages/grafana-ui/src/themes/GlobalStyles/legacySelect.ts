// some plugins depend on these classes
// TODO we should aim to remove this for Grafana 12
import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getLegacySelectStyles(theme: GrafanaTheme2) {
  return css({
    '.gf-form-select-box__control': {
      width: '100%',
      marginRight: theme.spacing(0.5),
      backgroundColor: theme.components.input.background,
      border: `1px solid ${theme.components.input.borderColor}`,
      borderRadius: theme.shape.radius.default,
      color: theme.components.input.text,
      cursor: 'default',
      height: theme.spacing(4),
      outline: 'none',
      overflow: 'hidden',
      position: 'relative',
    },

    '.gf-form-select-box__control--is-focused': {
      backgroundColor: theme.components.input.background,
      borderColor: theme.colors.primary.border,
      outline: 'none',
      boxShadow: `inset 0 1px 1px rgba(0, 0, 0, 0.075), 0 0 8px ${theme.colors.primary.border}`,
    },

    '.gf-form-select-box__control--is-disabled': {
      backgroundColor: theme.colors.action.disabledBackground,
    },

    '.gf-form-select-box__control--menu-right': {
      '.gf-form-select-box__menu': {
        right: 0,
        left: 'unset',
      },
    },

    '.gf-form-select-box__input': {
      input: {
        lineHeight: 'inherit',
      },
    },

    '.gf-form-select-box__menu': {
      background: theme.colors.background.primary,
      boxShadow: theme.shadows.z3,
      position: 'absolute',
      zIndex: theme.zIndex.dropdown,
      minWidth: '100%',

      '&-notice--no-options': {
        backgroundColor: theme.components.input.background,
        padding: '10px',
      },
    },

    '.gf-form-select-box__menu-list': {
      overflowY: 'auto',
      maxHeight: '300px',
      maxWidth: '600px',
    },

    '.tag-filter .gf-form-select-box__menu': {
      width: '100%',
    },

    '.gf-form-select-box__multi-value': {
      display: 'inline',
      margin: '0 6px 0 0',
      cursor: 'pointer',
    },

    '.gf-form-select-box__multi-value__remove': {
      textAlign: 'center',
      display: 'inline-block',
      marginLeft: '2px',
      position: 'relative',
    },

    '.gf-form-select-box__multi-value__label': {
      display: 'inline',
      verticalAlign: 'middle',
    },

    '.gf-form-select-box__option': {
      borderLeft: '2px solid transparent',
      whiteSpace: 'nowrap',
      backgroundColor: theme.components.input.background,

      '&.gf-form-select-box__option--is-focused': {
        color: theme.colors.text.primary,
        background: theme.colors.action.hover,
        borderImage: theme.colors.gradients.brandVertical,
        borderImageSlice: 1,
        borderStyle: 'solid',
        borderTop: 0,
        borderRight: 0,
        borderBottom: 0,
        borderLeftWidth: '2px',
      },

      '&.gf-form-select-box__option--is-selected': {
        '.fa': {
          color: theme.colors.text.primary,
        },
      },
    },

    '.gf-form-select-box__placeholder': {
      color: theme.colors.text.disabled,
    },

    '.gf-form-select-box__control--is-focused .gf-form-select-box__placeholder': {
      display: 'none',
    },

    '.gf-form-select-box__value-container': {
      display: 'inline-block',
      padding: '6px 20px 6px 10px',
      verticalAlign: 'middle',

      '> div': {
        display: 'inline-block',
        verticalAlign: 'middle',
      },
    },

    '.gf-form-select-box__indicators': {
      position: 'absolute',
      height: '100%',
      right: '8px',
      top: '1px',
      display: 'inline-block',
      textAlign: 'right',
    },

    '.gf-form-input--form-dropdown': {
      padding: 0,
      border: 0,
      overflow: 'visible',
      position: 'relative',
    },

    '.gf-form--has-input-icon': {
      '.gf-form-select-box__value-container': {
        paddingLeft: '30px',
      },
    },

    '.gf-form-select-box__desc-option': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      justifyItems: 'center',
      cursor: 'pointer',
      padding: '7px 10px',
      width: '100%',
    },

    '.gf-form-select-box__desc-option__body': {
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      paddingRight: '10px',
      fontWeight: theme.typography.fontWeightMedium,
    },

    '.gf-form-select-box__desc-option__desc': {
      fontWeight: 'normal',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    },

    '.gf-form-select-box__desc-option__img': {
      width: '16px',
      marginRight: '10px',
    },

    '.gf-form-select-box__option-group__header': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      justifyItems: 'center',
      cursor: 'pointer',
      padding: '7px 10px',
      width: '100%',
      borderBottom: `1px solid ${theme.v1.palette.dark9}`,
      textTransform: 'capitalize',

      '.fa': {
        paddingRight: '2px',
      },
    },

    '.gf-form-select-box-button-select': {
      height: 'auto',
    },

    '.select-button': {
      display: 'flex',
      alignItems: 'center',
    },
  });
}
