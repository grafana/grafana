import React, { HTMLProps } from 'react';
import { css, cx } from 'emotion';
import uniqueId from 'lodash/uniqueId';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme } from '../../themes';
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
        left: -100vw;
        z-index: -1000;
        position: absolute;

        &:disabled + label {
          background: ${theme.colors.formSwitchBgDisabled};
          cursor: not-allowed;
        }

        &:checked + label {
          background: ${theme.colors.formSwitchBgActive};

          &:hover {
            background: ${theme.colors.formSwitchBgActiveHover};
          }

          &::after {
            transform: translate3d(18px, -50%, 0);
          }
        }

        &:focus + label {
          ${getFocusCss(theme)};
        }
      }

      label {
        width: 100%;
        height: 100%;
        cursor: pointer;
        border: none;
        border-radius: 50px;
        background: ${theme.colors.formSwitchBg};
        transition: all 0.3s ease;

        &:hover {
          background: ${theme.colors.formSwitchBgHover};
        }

        &::after {
          position: absolute;
          display: block;
          content: '';
          width: 12px;
          height: 12px;
          border-radius: 6px;
          background: ${theme.colors.formSwitchDot};
          top: 50%;
          transform: translate3d(2px, -50%, 0);
          transition: transform 0.2s cubic-bezier(0.19, 1, 0.22, 1);
        }
      }
    }
    `,
  };
});

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ value, checked, disabled = false, onChange, ...inputProps }, ref) => {
    const theme = useTheme();
    const styles = getSwitchStyles(theme);
    const switchId = uniqueId('switch-');

    return (
      <div className={cx(styles.switch)}>
        <input
          type="checkbox"
          disabled={disabled}
          checked={value}
          onChange={event => {
            onChange?.(event);
          }}
          id={switchId}
          {...inputProps}
          ref={ref}
        />
        <label htmlFor={switchId} />
      </div>
    );
  }
);
