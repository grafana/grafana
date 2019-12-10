import React from 'react';
import { useTheme } from '../../../themes/ThemeContext';
import { getFocusCss } from '../commonStyles';
import { getInputStyles } from '../Input/Input';
import { cx, css } from 'emotion';

interface InputControlProps {
  isFocused: boolean;
  innerProps: any;
}

export const InputControl = React.forwardRef<HTMLDivElement, React.PropsWithChildren<InputControlProps>>(
  ({ isFocused, children, innerProps }, ref) => {
    const theme = useTheme();

    const styles = getInputStyles({ theme, invalid: false });

    return (
      <>
        <div
          className={cx(
            styles.wrapper,
            isFocused &&
              css`
                ${getFocusCss(theme)}
              `,
            css`
              min-height: 32px;
              height: auto;
            `
          )}
          ref={ref}
          {...innerProps}
        >
          <div
            className={cx(
              styles.inputWrapper,
              css`
                max-width: 100%;
              `
            )}
          >
            <div className={styles.input}>{children}</div>
          </div>
        </div>
      </>
    );
  }
);
