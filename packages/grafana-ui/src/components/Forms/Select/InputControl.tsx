import React from 'react';
import { useTheme } from '../../../themes/ThemeContext';
import { getFocusCss, sharedInputStyle } from '../commonStyles';
import { getInputStyles } from '../Input/Input';
import { cx, css } from 'emotion';

interface InputControlProps {
  /** Show an icon as a prefix in the input */
  prefix?: JSX.Element | string | null;
  isFocused: boolean;
  invalid: boolean;
  disabled: boolean;
  innerProps: any;
}

export const InputControl = React.forwardRef<HTMLDivElement, React.PropsWithChildren<InputControlProps>>(
  ({ isFocused, invalid, disabled, children, innerProps, prefix }, ref) => {
    const theme = useTheme();

    const styles = getInputStyles({ theme, invalid });

    return (
      <div
        className={cx(
          styles.wrapper,
          sharedInputStyle(theme, invalid),
          isFocused &&
            css`
              ${getFocusCss(theme)}
            `,
          disabled && styles.inputDisabled,
          css`
            min-height: 32px;
            height: auto;
            flex-direction: row;
            padding-right: 0;
            max-width: 100%;
            align-items: center;
            cursor: default;
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            position: relative;
            box-sizing: border-box;
          `,
          prefix &&
            css`
              padding-left: 0;
            `
        )}
        ref={ref}
        {...innerProps}
      >
        {prefix && (
          <div
            className={cx(
              styles.prefix,
              css`
                position: relative;
              `
            )}
          >
            {prefix}
          </div>
        )}
        {children}
      </div>
    );
  }
);
