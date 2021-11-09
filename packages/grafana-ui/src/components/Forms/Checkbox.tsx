import React, { HTMLProps, useCallback } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { getLabelStyles } from './Label';
import { stylesFactory, useStyles2 } from '../../themes';
import { css, cx } from '@emotion/css';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { ComponentSize } from '../../types/size';

export interface CheckboxProps extends Omit<HTMLProps<HTMLInputElement>, 'value' | 'size'> {
  label?: string;
  description?: string;
  value?: boolean;
  size?: ComponentSize;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, value, size, onChange, disabled, className, ...inputProps }, ref) => {
    const handleOnChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (onChange) {
          onChange(e);
        }
      },
      [onChange]
    );
    const styles = useStyles2(getCheckboxStyles);
    const { inputStyle, checkmarkStyle, labelStyle, descriptionStyle } = getPropertiesForCheckboxSize(styles, size);

    return (
      <label className={cx(styles.wrapper, className)}>
        <input
          type="checkbox"
          className={inputStyle}
          checked={value}
          disabled={disabled}
          onChange={handleOnChange}
          {...inputProps}
          ref={ref}
        />
        <span className={checkmarkStyle} />
        {label && <span className={labelStyle}>{label}</span>}
        {description && <span className={descriptionStyle}>{description}</span>}
      </label>
    );
  }
);

interface CheckboxStyles {
  wrapper: string;
  smInput: string;
  smCheckmark: string;
  smLabel: string;
  smDescription: string;
  mdInput: string;
  mdCheckmark: string;
  mdLabel: string;
  mdDescription: string;
  lgInput: string;
  lgCheckmark: string;
  lgLabel: string;
  lgDescription: string;
}

export const getCheckboxStyles = stylesFactory((theme: GrafanaTheme2) => {
  const labelStyles = getLabelStyles(theme);
  const labelPadding = 1;

  return {
    wrapper: css`
      position: relative;
      vertical-align: middle;
      font-size: 0;
    `,
    smInput: css`
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
    smCheckmark: css`
      position: relative; /* Checkbox should be layered on top of the invisible input so it recieves :hover */
      z-index: 2;
      display: inline-block;
      width: ${theme.spacing(2)};
      height: ${theme.spacing(2)};
      border-radius: ${theme.shape.borderRadius()};
      background: ${theme.components.input.background};
      border: 1px solid ${theme.components.input.borderColor};

      &:hover {
        cursor: pointer;
        border-color: ${theme.components.input.borderHover};
      }
    `,
    smLabel: cx(
      labelStyles.label,
      css`
        position: relative;
        z-index: 2;
        padding-left: ${theme.spacing(labelPadding)};
        white-space: nowrap;
        cursor: pointer;
        position: relative;
        top: -3px;
      `
    ),
    smDescription: cx(
      labelStyles.description,
      css`
        line-height: ${theme.typography.bodySmall.lineHeight};
        padding-left: ${theme.spacing(2 + labelPadding)};
        margin-top: 0; /* The margin effectively comes from the top: -2px on the label above it */
      `
    ),
    mdInput: css`
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
          left: 10px;
          top: 1px;
          width: 12px;
          height: 24px;
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
    mdCheckmark: css`
      position: relative; /* Checkbox should be layered on top of the invisible input so it recieves :hover */
      z-index: 2;
      display: inline-block;
      width: ${theme.spacing(4)};
      height: ${theme.spacing(4)};
      border-radius: ${theme.shape.borderRadius()};
      background: ${theme.components.input.background};
      border: 1px solid ${theme.components.input.borderColor};

      &:hover {
        cursor: pointer;
        border-color: ${theme.components.input.borderHover};
      }
    `,
    mdLabel: cx(
      labelStyles.label,
      css`
        position: relative;
        z-index: 2;
        padding-left: ${theme.spacing(labelPadding)};
        white-space: nowrap;
        cursor: pointer;
        position: relative;
        top: -11px;
      `
    ),
    mdDescription: cx(
      labelStyles.description,
      css`
        line-height: ${theme.typography.bodySmall.lineHeight};
        padding-left: ${theme.spacing(4 + labelPadding)};
        margin-top: 0; /* The margin effectively comes from the top: -2px on the label above it */
      `
    ),
    lgInput: css`
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
          left: 15px;
          top: 1px;
          width: 18px;
          height: 36px;
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
    lgCheckmark: css`
      position: relative; /* Checkbox should be layered on top of the invisible input so it recieves :hover */
      z-index: 2;
      display: inline-block;
      width: ${theme.spacing(6)};
      height: ${theme.spacing(6)};
      border-radius: ${theme.shape.borderRadius()};
      background: ${theme.components.input.background};
      border: 1px solid ${theme.components.input.borderColor};

      &:hover {
        cursor: pointer;
        border-color: ${theme.components.input.borderHover};
      }
    `,
    lgLabel: cx(
      labelStyles.label,
      css`
        position: relative;
        z-index: 2;
        padding-left: ${theme.spacing(labelPadding)};
        white-space: nowrap;
        cursor: pointer;
        position: relative;
        top: -18px;
      `
    ),
    lgDescription: cx(
      labelStyles.description,
      css`
        line-height: ${theme.typography.bodySmall.lineHeight};
        padding-left: ${theme.spacing(6 + labelPadding)};
        margin-top: 0; /* The margin effectively comes from the top: -2px on the label above it */
      `
    ),
  };
});

function getPropertiesForCheckboxSize(styles: CheckboxStyles, size?: ComponentSize) {
  switch (size) {
    case 'md':
      return {
        inputStyle: styles.mdInput,
        checkmarkStyle: styles.mdCheckmark,
        labelStyle: styles.mdLabel,
        descriptionStyle: styles.mdDescription,
      };
    case 'lg':
      return {
        inputStyle: styles.lgInput,
        checkmarkStyle: styles.lgCheckmark,
        labelStyle: styles.lgLabel,
        descriptionStyle: styles.lgDescription,
      };
    case 'sm':
    default:
      return {
        inputStyle: styles.smInput,
        checkmarkStyle: styles.smCheckmark,
        labelStyle: styles.smLabel,
        descriptionStyle: styles.smDescription,
      };
  }
}

Checkbox.displayName = 'Checkbox';
