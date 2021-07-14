import React from 'react';
import { useTheme2 } from '../../themes/ThemeContext';
import { sharedInputStyle } from '../Forms/commonStyles';
import { getInputStyles } from '../Input/Input';
import { css, cx } from '@emotion/css';
import { stylesFactory } from '../../themes';
import { GrafanaTheme2 } from '@grafana/data';
import { focusCss } from '../../themes/mixins';

interface InputControlProps {
  /** Show an icon as a prefix in the input */
  prefix?: JSX.Element | string | null;
  focused: boolean;
  invalid: boolean;
  disabled: boolean;
  innerProps: any;
}

const getInputControlStyles = stylesFactory(
  (theme: GrafanaTheme2, invalid: boolean, focused: boolean, disabled: boolean, withPrefix: boolean) => {
    const styles = getInputStyles({ theme, invalid });

    return {
      wrapper: cx(
        styles.wrapper,
        sharedInputStyle(theme, invalid),
        focused &&
          css`
            ${focusCss(theme.v1)}
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
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
        `,
        withPrefix &&
          css`
            padding-left: 0;
          `
      ),
      prefix: cx(
        styles.prefix,
        css`
          position: relative;
        `
      ),
    };
  }
);

export const InputControl = React.forwardRef<HTMLDivElement, React.PropsWithChildren<InputControlProps>>(
  function InputControl({ focused, invalid, disabled, children, innerProps, prefix, ...otherProps }, ref) {
    const theme = useTheme2();
    const styles = getInputControlStyles(theme, invalid, focused, disabled, !!prefix);
    return (
      <div className={styles.wrapper} {...innerProps} ref={ref}>
        {prefix && <div className={cx(styles.prefix)}>{prefix}</div>}
        {children}
      </div>
    );
  }
);
