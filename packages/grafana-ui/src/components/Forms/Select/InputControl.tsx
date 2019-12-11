import React from 'react';
import { useTheme } from '../../../themes/ThemeContext';
import { getFocusCss, sharedInputStyle } from '../commonStyles';
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
      <div
        className={cx(
          styles.wrapper,
          sharedInputStyle(theme),
          isFocused &&
            css`
              ${getFocusCss(theme)}
            `,
          css`
            min-height: 32px;
            height: auto;
            flex-direction: row;
            padding-right: 0;
            max-width: 100%;
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
              display: flex;
              flex-direction: row;
              justify-content: space-between;
            `
          )}
        >
          {children}
        </div>
      </div>
    );
  }
);
