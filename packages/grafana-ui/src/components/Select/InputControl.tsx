import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory } from '../../themes';
import { useTheme2 } from '../../themes/ThemeContext';
import { inputPadding } from '../Forms/commonStyles';
import { getInputStyles } from '../Input/Input';

interface InputControlProps {
  /** Show an icon as a prefix in the input */
  prefix?: JSX.Element | string | null;
  focused: boolean;
  invalid: boolean;
  disabled: boolean;
  innerProps: JSX.IntrinsicElements['div'];
}

const getInputControlStyles = stylesFactory((theme: GrafanaTheme2, invalid: boolean, withPrefix: boolean) => {
  const styles = getInputStyles({ theme, invalid });

  return {
    input: cx(
      inputPadding(theme),
      css`
        width: 100%;
        max-width: 100%;
        display: flex;
        flex-direction: row;
        align-items: center;
        flex-wrap: wrap;
        justify-content: space-between;
        padding-right: 0;
        position: relative;
        box-sizing: border-box;
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
});

export const InputControl = React.forwardRef<HTMLDivElement, React.PropsWithChildren<InputControlProps>>(
  function InputControl({ focused, invalid, disabled, children, innerProps, prefix, ...otherProps }, ref) {
    const theme = useTheme2();
    const styles = getInputControlStyles(theme, invalid, !!prefix);
    return (
      <div className={styles.input} {...innerProps} ref={ref}>
        {prefix && <div className={cx(styles.prefix)}>{prefix}</div>}
        {children}
      </div>
    );
  }
);
