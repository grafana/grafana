import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { getFocusStyles } from '../../themes/mixins';
import { getInputStyles } from '../Input/Input';

export const getMultiComboboxStyles = (
  theme: GrafanaTheme2,
  isOpen: boolean,
  invalid?: boolean,
  disabled?: boolean,
  width?: number | 'auto'
) => {
  const inputStyles = getInputStyles({ theme, invalid });
  const focusStyles = getFocusStyles(theme);

  const wrapperWidth = width && width !== 'auto' ? theme.spacing(width) : '100%';

  return {
    wrapper: cx(
      inputStyles.input,
      css({
        display: 'flex',
        width: width === 'auto' ? 'auto' : wrapperWidth,
        gap: theme.spacing(0.5),
        padding: theme.spacing(0.5),
        paddingRight: 28, // Account for suffix
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
      minWidth: 50,
      '&::placeholder': {
        color: theme.colors.text.disabled,
      },
      '&:focus': {
        outline: 'none',
      },
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
