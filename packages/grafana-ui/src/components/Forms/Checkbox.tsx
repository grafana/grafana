import { css, cx } from '@emotion/css';
import React, { HTMLProps, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory, useStyles2 } from '../../themes';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';

import { getLabelStyles } from './Label';

export interface CheckboxProps extends Omit<HTMLProps<HTMLInputElement>, 'value'> {
  label?: string;
  description?: string;
  value?: boolean;
  // htmlValue allows to specify the input "value" attribute
  htmlValue?: string | number;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, value, htmlValue, onChange, disabled, className, ...inputProps }, ref) => {
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
        <div>
          <input
            type="checkbox"
            className={styles.input}
            checked={value}
            disabled={disabled}
            onChange={handleOnChange}
            value={htmlValue}
            {...inputProps}
            ref={ref}
          />
          <span className={styles.checkmark} />
        </div>
        <div>
          {label && <span className={styles.label}>{label}</span>}
          {description && <span className={styles.description}>{description}</span>}
        </div>
      </label>
    );
  }
);

export const getCheckboxStyles = stylesFactory((theme: GrafanaTheme2) => {
  const labelStyles = getLabelStyles(theme);
  const checkboxSize = 2;
  const labelPadding = 1;

  return {
    wrapper: css`
      display: inline-flex;
      gap: ${theme.spacing(labelPadding)};
      align-items: baseline;
      position: relative;
      vertical-align: middle;
      font-size: 0;
    `,
    input: css`
      position: absolute;
      z-index: 1;
      top: 0;
      left: 0;
      width: 100% !important; // global styles unset this
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
          z-index: 2;
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
      position: relative; /* Checkbox should be layered on top of the invisible input so it recieves :hover */
      z-index: 2;
      display: inline-block;
      width: ${theme.spacing(checkboxSize)};
      height: ${theme.spacing(checkboxSize)};
      border-radius: ${theme.shape.borderRadius()};
      background: ${theme.components.input.background};
      border: 1px solid ${theme.components.input.borderColor};

      &:hover {
        cursor: pointer;
        border-color: ${theme.components.input.borderHover};
      }
    `,
    label: cx(
      labelStyles.label,
      css`
        position: relative;
        z-index: 2;
        cursor: pointer;
        top: -3px;
        max-width: fit-content;
        line-height: ${theme.typography.bodySmall.lineHeight};
        margin-bottom: 0;
      `
    ),
    description: cx(
      labelStyles.description,
      css`
        line-height: ${theme.typography.bodySmall.lineHeight};
        margin-top: 0; /* The margin effectively comes from the top: -2px on the label above it */
      `
    ),
  };
});

Checkbox.displayName = 'Checkbox';
