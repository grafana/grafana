import React, { HTMLProps, useRef } from 'react';
import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import { GrafanaTheme, deprecationWarning } from '@grafana/data';
import { stylesFactory, useTheme } from '../../themes';
import { focusCss, getMouseFocusStyles } from '../../themes/mixins';

export interface Props extends Omit<HTMLProps<HTMLInputElement>, 'value'> {
  value?: boolean;
  /** Make switch's background and border transparent */
  transparent?: boolean;
}

export const Switch = React.forwardRef<HTMLInputElement, Props>(
  ({ value, checked, disabled, onChange, id, ...inputProps }, ref) => {
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
          background: ${theme.v2.palette.action.disabledBackground};
          cursor: not-allowed;
        }

        &:checked + label {
          background: ${theme.v2.palette.primary.main};
          border-color: ${theme.v2.palette.primary.main};

          &:hover {
            background: ${theme.v2.palette.primary.shade};
          }

          &::after {
            transform: translate3d(18px, -50%, 0);
            background: ${theme.v2.palette.primary.contrastText};
          }
        }

        &:focus + label,
        &:focus-visible + label {
          ${focusCss(theme)}
        }

        &:focus:not(:focus-visible) + label {
          ${getMouseFocusStyles(theme.v2)}
        }
      }

      label {
        width: 100%;
        height: 100%;
        cursor: pointer;
        border: none;
        border-radius: 50px;
        background: ${theme.v2.components.input.background};
        border: 1px solid ${theme.v2.components.input.border};
        transition: all 0.3s ease;

        &:hover {
          border-color: ${theme.v2.components.input.borderHover};
        }

        &::after {
          position: absolute;
          display: block;
          content: '';
          width: 12px;
          height: 12px;
          border-radius: 6px;
          background: ${theme.v2.palette.text.secondary};
          box-shadow: ${theme.v2.shadows.z1};
          top: 50%;
          transform: translate3d(2px, -50%, 0);
          transition: transform 0.2s cubic-bezier(0.19, 1, 0.22, 1);
        }
      }
    `,
    inlineContainer: css`
      padding: ${theme.v2.spacing(0, 1)};
      height: ${theme.v2.spacing(theme.v2.components.height.md)};
      display: flex;
      align-items: center;
      background: ${transparent ? 'transparent' : theme.v2.components.input.background};
      border: 1px solid ${transparent ? 'transparent' : theme.v2.components.input.border};
      border-radius: ${theme.v2.shape.borderRadius()};
    `,
  };
});
