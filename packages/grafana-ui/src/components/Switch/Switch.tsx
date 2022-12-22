import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { HTMLProps, useRef } from 'react';

import { GrafanaTheme2, deprecationWarning } from '@grafana/data';

import { stylesFactory, useTheme2 } from '../../themes';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';

export interface Props extends Omit<HTMLProps<HTMLInputElement>, 'value'> {
  value?: boolean;
  /** Make switch's background and border transparent */
  transparent?: boolean;
}

export const Switch = React.forwardRef<HTMLInputElement, Props>(
  ({ value, checked, disabled, onChange, id, label, ...inputProps }, ref) => {
    if (checked) {
      deprecationWarning('Switch', 'checked prop', 'value');
    }

    const theme = useTheme2();
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
        <label htmlFor={switchIdRef.current} aria-label={label ?? 'Toggle switch'} />
      </div>
    );
  }
);

Switch.displayName = 'Switch';

export interface InlineSwitchProps extends Props {
  showLabel?: boolean;
}

export const InlineSwitch = React.forwardRef<HTMLInputElement, InlineSwitchProps>(
  ({ transparent, className, showLabel, label, value, id, ...props }, ref) => {
    const theme = useTheme2();
    const styles = getSwitchStyles(theme, transparent);
    return (
      <div className={cx(styles.inlineContainer, className)}>
        {showLabel && (
          <label
            htmlFor={id}
            className={cx(styles.inlineLabel, value && styles.inlineLabelEnabled, 'inline-switch-label')}
          >
            {label}
          </label>
        )}
        <Switch {...props} id={id} label={label} ref={ref} value={value} />
      </div>
    );
  }
);

InlineSwitch.displayName = 'Switch';

const getSwitchStyles = stylesFactory((theme: GrafanaTheme2, transparent?: boolean) => {
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
          background: ${theme.colors.action.disabledBackground};
          cursor: not-allowed;
        }

        &:checked + label {
          background: ${theme.colors.primary.main};
          border-color: ${theme.colors.primary.main};

          &:hover {
            background: ${theme.colors.primary.shade};
          }

          &::after {
            transform: translate3d(18px, -50%, 0);
            background: ${theme.colors.primary.contrastText};
          }
        }

        &:focus + label,
        &:focus-visible + label {
          ${getFocusStyles(theme)}
        }

        &:focus:not(:focus-visible) + label {
          ${getMouseFocusStyles(theme)}
        }
      }

      label {
        width: 100%;
        height: 100%;
        cursor: pointer;
        border: none;
        border-radius: 50px;
        background: ${theme.components.input.background};
        border: 1px solid ${theme.components.input.borderColor};
        transition: all 0.3s ease;

        &:hover {
          border-color: ${theme.components.input.borderHover};
        }

        &::after {
          position: absolute;
          display: block;
          content: '';
          width: 12px;
          height: 12px;
          border-radius: 6px;
          background: ${theme.colors.text.secondary};
          box-shadow: ${theme.shadows.z1};
          top: 50%;
          transform: translate3d(2px, -50%, 0);
          transition: transform 0.2s cubic-bezier(0.19, 1, 0.22, 1);
        }
      }
    `,
    inlineContainer: css`
      padding: ${theme.spacing(0, 1)};
      height: ${theme.spacing(theme.components.height.md)};
      display: inline-flex;
      align-items: center;
      background: ${transparent ? 'transparent' : theme.components.input.background};
      border: 1px solid ${transparent ? 'transparent' : theme.components.input.borderColor};
      border-radius: ${theme.shape.borderRadius()};

      &:hover {
        border: 1px solid ${transparent ? 'transparent' : theme.components.input.borderHover};

        .inline-switch-label {
          color: ${theme.colors.text.primary};
        }
      }
    `,
    inlineLabel: css`
      cursor: pointer;
      padding-right: ${theme.spacing(1)};
      color: ${theme.colors.text.secondary};
      white-space: nowrap;
    `,
    inlineLabelEnabled: css`
      color: ${theme.colors.text.primary};
    `,
  };
});
