import React, { HTMLProps, useCallback } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { getLabelStyles } from './Label';
import { stylesFactory, useStyles2 } from '../../themes';
import { css, cx } from '@emotion/css';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';

export interface CheckboxProps extends Omit<HTMLProps<HTMLInputElement>, 'value'> {
  label?: string;
  description?: string;
  value?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, value, onChange, disabled, className, ...inputProps }, ref) => {
    const handleOnChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (onChange) {
          onChange(e);
        }
      },
      [onChange]
    );
    const styles = useStyles2(getCheckboxStyles);

    return (
      <label className={cx(styles.wrapper, className)}>
        <input
          type="checkbox"
          className={styles.input}
          checked={value}
          disabled={disabled}
          onChange={handleOnChange}
          {...inputProps}
          ref={ref}
        />
        <span className={styles.checkmark} />
        {label && <span className={styles.label}>{label}</span>}
        {description && <span className={styles.description}>{description}</span>}
      </label>
    );
  }
);

export const getCheckboxStyles = stylesFactory((theme: GrafanaTheme2) => {
  const labelStyles = getLabelStyles(theme);
  const checkboxSize = '16px';
  return {
    label: cx(
      labelStyles.label,
      css`
        padding-left: ${theme.spacing(1)};
        white-space: nowrap;
        cursor: pointer;
      `
    ),
    description: cx(
      labelStyles.description,
      css`
        line-height: ${theme.typography.bodySmall.lineHeight};
        padding-left: ${theme.spacing(1)};
      `
    ),
    wrapper: css`
      position: relative;
      padding-left: ${checkboxSize};
      vertical-align: middle;
      min-height: ${theme.spacing(3)};
    `,
    input: css`
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;

      &:focus + span,
      &:focus-visible + span {
        ${getFocusStyles(theme)}
      }

      &:focus:not(:focus-visible) + span {
        ${getMouseFocusStyles(theme)}
      }

      /**
       * Using adjacent sibling selector to style checked state.
       * Primarily to limit the classes necessary to use when these classes will be used
       * for angular components styling
       * */
      &:checked + span {
        background: blue;
        background: ${theme.colors.primary.main};
        border: none;

        &:hover {
          background: ${theme.colors.primary.shade};
        }

        &:after {
          content: '';
          position: absolute;
          left: 5px;
          top: 1px;
          width: 6px;
          height: 12px;
          border: solid ${theme.colors.primary.contrastText};
          border-width: 0 3px 3px 0;
          transform: rotate(45deg);
        }
      }

      &:disabled + span {
        background-color: ${theme.colors.action.disabledBackground};
        cursor: not-allowed;
        &:hover {
          background-color: ${theme.colors.action.disabledBackground};
        }

        &:after {
          border-color: ${theme.colors.action.disabledText};
        }
      }
    `,
    checkmark: css`
      display: inline-block;
      width: ${checkboxSize};
      height: ${checkboxSize};
      border-radius: ${theme.shape.borderRadius()};
      margin-right: ${theme.spacing(1)};
      background: ${theme.components.input.background};
      border: 1px solid ${theme.components.input.borderColor};
      position: absolute;
      top: 2px;
      left: 0;

      &:hover {
        cursor: pointer;
        border-color: ${theme.components.input.borderHover};
      }
    `,
  };
});

Checkbox.displayName = 'Checkbox';
