import { css, cx } from '@emotion/css';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { getButtonFocusStyles, getMouseFocusStyles } from '../../themes/mixins';

import { clearButtonStyles } from './Button';

export interface InlineButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

/**
 * Renders an action as a semantic button with the visual treatment of inline text.
 * Use TextLink instead when the interaction navigates to another page.
 */
export const InlineButton = forwardRef<HTMLButtonElement, InlineButtonProps>(
  ({ children, className, type = 'button', ...rest }, ref) => {
    const theme = useTheme2();
    const styles = getStyles(theme);

    return (
      <button ref={ref} type={type} className={cx(clearButtonStyles(theme), styles.button, className)} {...rest}>
        {children}
      </button>
    );
  }
);

InlineButton.displayName = 'InlineButton';

const getStyles = (theme: GrafanaTheme2) => ({
  button: css({
    appearance: 'none',
    color: theme.colors.text.link,
    cursor: 'pointer',
    font: 'inherit',
    lineHeight: 'inherit',
    textAlign: 'inherit',
    textDecoration: 'underline',
    verticalAlign: 'baseline',

    '&:hover': {
      textDecoration: 'none',
    },

    '&:focus, &:focus-visible': getButtonFocusStyles(theme),
    '&:focus:not(:focus-visible)': getMouseFocusStyles(theme),

    '&:disabled': {
      color: theme.colors.text.disabled,
      cursor: 'not-allowed',
      textDecoration: 'none',
    },
  }),
});
