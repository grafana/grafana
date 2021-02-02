import React, { HTMLProps, useRef } from 'react';
import { css, cx } from 'emotion';
import uniqueId from 'lodash/uniqueId';
import { GrafanaTheme, deprecationWarning } from '@grafana/data';
import { stylesFactory, useTheme } from '../../themes';
import { focusCss } from '../../themes/mixins';

export interface Props extends Omit<HTMLProps<HTMLInputElement>, 'value'> {
  value?: boolean;
  /** Make switch's background and border transparent */
  transparent?: boolean;
}

export const Switch = React.forwardRef<HTMLInputElement, Props>(
  ({ value, checked, disabled = false, onChange, id, ...inputProps }, ref) => {
    if (checked) {
      deprecationWarning('Switch', 'checked prop', 'value');
    }

    const theme = useTheme();
    const styles = getSwitchStyles(theme);
    const switchIdRef = useRef(id ? id : uniqueId('switch-'));

    return (
      <div className={cx(styles.switch)}>
        <input
          type="checkbox"
          disabled={disabled}
          checked={value}
          onChange={(event) => {
            onChange?.(event);
          }}
          id={switchIdRef.current}
          {...inputProps}
          ref={ref}
        />
        <label htmlFor={switchIdRef.current} />
      </div>
    );
  }
);

Switch.displayName = 'Switch';

export const InlineSwitch = React.forwardRef<HTMLInputElement, Props>(({ transparent, ...props }, ref) => {
  const theme = useTheme();
  const styles = getSwitchStyles(theme, transparent);

  return (
    <div className={styles.inlineContainer}>
      <Switch {...props} ref={ref} />
    </div>
  );
});

InlineSwitch.displayName = 'Switch';

const getSwitchStyles = stylesFactory((theme: GrafanaTheme, transparent?: boolean) => {
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
          ${focusCss(theme)};
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
    `,
    inlineContainer: css`
      padding: 0 ${theme.spacing.sm};
      height: ${theme.spacing.formInputHeight}px;
      display: flex;
      align-items: center;
      background: ${transparent ? 'transparent' : theme.colors.formInputBg};
      border: 1px solid ${transparent ? 'transparent' : theme.colors.formInputBorder};
      border-radius: ${theme.border.radius.md};
    `,
  };
});
