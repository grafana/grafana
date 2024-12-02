import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { getFocusStyles } from '../../themes/mixins';
import { getInputStyles } from '../Input/Input';

export const getMultiComboboxStyles = (theme: GrafanaTheme2) => {
  const inputStyles = getInputStyles({ theme });
  const focusStyles = getFocusStyles(theme);

  return {
    wrapper: cx(
      inputStyles.input,
      css({
        display: 'flex',
        gap: theme.spacing(0.5),
        padding: theme.spacing(0.5),
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
      minWidth: '0',
      '&::placeholder': {
        color: theme.colors.text.disabled,
      },
      '&:focus': {
        outline: 'none',
      },
    }),
    pillWrapper: css({
      display: 'inline-flex',
      flexWrap: 'nowrap',
      gap: theme.spacing(0.5),
    }),
    restNumber: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(0, 1),
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.secondary,
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: theme.colors.action.hover,
      },
    }),
  };
};
