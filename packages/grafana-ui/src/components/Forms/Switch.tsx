import React, { HTMLProps } from 'react';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { getFocusCss } from './commonStyles';

export interface SwitchProps extends Omit<HTMLProps<HTMLInputElement>, 'value'> {
  value?: boolean;
}

export const getSwitchStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    switch: css`
      width: 32px;
      height: 16px;
      position: relative;

      input {
        opacity: 0;
        width: 100% !important;
        height: 100%;
        position: relative;
        z-index: 1;
        cursor: pointer;

        &:focus ~ div {
          ${getFocusCss(theme)};
        }
        &[disabled] {
          background: ${theme.colors.formSwitchBgDisabled};
        }
      }

      input ~ div {
        width: 100%;
        height: 100%;
        background: red;
        z-index: 0;
        position: absolute;
        top: 0;
        left: 0;
        background: ${theme.colors.formSwitchBg};
        transition: all 0.3s ease;
        border-radius: 50px;
        border: none;
        display: block;
        padding: 0;
        &:hover {
          background: ${theme.colors.formSwitchBgHover};
        }
        &:after {
          content: '';
          transition: transform 0.2s cubic-bezier(0.19, 1, 0.22, 1);
          position: absolute;
          z-index: 0;
          top: 50%;
          display: block;
          width: 12px;
          height: 12px;
          background: ${theme.colors.formSwitchDot};
          border-radius: 6px;
          transform: translate3d(2px, -50%, 0);
        }
      }
      input:checked ~ div {
        background: ${theme.colors.formSwitchBgActive};
        &:hover {
          background: ${theme.colors.formSwitchBgActiveHover};
        }

        &:after {
          transform: translate3d(16px, -50%, 0);
        }
      }
    `,
  };
});
export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ value, checked, disabled = false, onChange, ...inputProps }, ref) => {
    const theme = useTheme();
    const styles = getSwitchStyles(theme);

    return (
      <div className={cx(styles.switch)}>
        <input
          type="checkbox"
          disabled={disabled}
          checked={value}
          onChange={event => {
            if (onChange) {
              onChange(event);
            }
          }}
          {...inputProps}
          ref={ref}
        />
        <div></div>
      </div>
    );
  }
);
