import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { getFocusStyles } from '../../themes/mixins';
import { getInputStyles } from '../Input/Input';

export const getMultiComboboxStyles = (
  theme: GrafanaTheme2,
  isOpen: boolean,
  invalid?: boolean,
  disabled?: boolean,
  width?: number | 'auto',
  minWidth?: number,
  maxWidth?: number,
  isClearable?: boolean
) => {
  const inputStyles = getInputStyles({ theme, invalid });
  const focusStyles = getFocusStyles(theme);

  const wrapperWidth = width && width !== 'auto' ? theme.spacing(width) : '100%';
  const wrapperMinWidth = minWidth ? theme.spacing(minWidth) : '';
  const wrapperMaxWidth = maxWidth ? theme.spacing(maxWidth) : '';

  return {
    container: css({
      width: width === 'auto' ? 'auto' : wrapperWidth,
      minWidth: wrapperMinWidth,
      maxWidth: wrapperMaxWidth,
      display: width === 'auto' ? 'inline-block' : 'block',
    }), // wraps everything
    wrapper: cx(
      inputStyles.input,
      css({
        display: 'flex',
        width: '100%',
        gap: theme.spacing(0.5),
        padding: theme.spacing(0.5),
        paddingRight: isClearable ? theme.spacing(5) : 28, // Account for suffix
        '&:focus-within': {
          ...focusStyles,
        },
      })
    ),
    input: css({
      border: 'none',
      outline: 'none',
      background: 'transparent',
      flexGrow: 1,
      maxWidth: '100%',
      minWidth: 40, // This is a bit arbitrary, but is used to leave some space for clicking. This will override the minWidth property
      '&::placeholder': {
        color: theme.colors.text.disabled,
      },
      '&:focus': {
        outline: 'none',
        cursor: 'text',
      },
      cursor: 'pointer',
    }),

    pillWrapper: css({
      display: 'inline-flex',
      flexWrap: isOpen ? 'wrap' : 'nowrap',
      flexGrow: 1,
      minWidth: '50px',
      gap: theme.spacing(0.5),
    }),
    restNumber: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(0, 1),
      border: disabled ? `1px solid ${theme.colors.border.weak}` : 'none',
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.secondary,
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: theme.colors.action.hover,
      },
    }),
    suffix: inputStyles.suffix,
    disabled: inputStyles.inputDisabled,
  };
};
