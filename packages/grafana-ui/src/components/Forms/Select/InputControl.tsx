import React from 'react';
import { useTheme } from '../../../themes/ThemeContext';
import { getFocusCss, sharedInputStyle } from '../commonStyles';
import { getInputStyles } from '../Input/Input';
import { cx, css } from 'emotion';
import { Icon } from '../../Icon/Icon';

interface InputControlProps {
  /** Show an icon as a prefix in the input */
  prefix?: JSX.Element | string | null;
  isFocused: boolean;
  innerProps: any;
}

export const InputControl = React.forwardRef<HTMLDivElement, React.PropsWithChildren<InputControlProps>>(
  ({ isFocused, children, innerProps, prefix }, ref) => {
    const theme = useTheme();
    console.log('hasPrefix', prefix);
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
