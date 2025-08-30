import { css, cx } from '@emotion/css';
import { HTMLProps, useCallback } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';

import { getLabelStyles } from './Label';

export interface CheckboxProps extends Omit<HTMLProps<HTMLInputElement>, 'value'> {
  /** Label to display next to checkbox */
  label?: string;
  /** Description to display under the label */
  description?: string | React.ReactElement;
  /** Current value of the checkbox */
  value?: boolean;
  /** htmlValue allows to specify the input "value" attribute */
  htmlValue?: string | number;
  /** Sets the checkbox into a "mixed" state. This is only a visual change and does not affect the value. */
  indeterminate?: boolean;
  /** Show an invalid state around the input */
  invalid?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { label, description, value, htmlValue, onChange, disabled, className, indeterminate, invalid, ...inputProps },
    ref
  ) => {
    const handleOnChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (onChange) {
          onChange(e);
        }
      },
      [onChange]
    );
    const styles = useStyles2(getCheckboxStyles, invalid);

    const ariaChecked = indeterminate ? 'mixed' : value;

    return (
      <label className={cx(styles.wrapper, className)}>
        <div className={styles.checkboxWrapper}>
          <input
            type="checkbox"
            className={cx(styles.input, indeterminate && styles.inputIndeterminate)}
            checked={value}
            disabled={disabled}
            onChange={handleOnChange}
            value={htmlValue}
            aria-checked={ariaChecked}
            {...inputProps}
            ref={ref}
          />
          <span className={styles.checkmark} />
        </div>
        {label && <span className={styles.label}>{label}</span>}
        {description && <span className={styles.description}>{description}</span>}
      </label>
    );
  }
);

export const getCheckboxStyles = (theme: GrafanaTheme2, invalid = false) => {
  const labelStyles = getLabelStyles(theme);
  const checkboxSize = 2;
  const labelPadding = 1;

  const getBorderColor = (color: string) => {
    return invalid ? theme.colors.error.border : color;
  };

  return {
    wrapper: css({
      display: 'inline-grid',
      alignItems: 'center',
      columnGap: theme.spacing(labelPadding),
      // gridAutoRows is needed to prevent https://github.com/grafana/grafana/issues/68570 in safari
      gridAutoRows: 'max-content',
      position: 'relative',
      verticalAlign: 'middle',
    }),
    input: css({
      position: 'absolute',
      zIndex: 1,
      top: 0,
      left: 0,
      width: '100% !important', // global styles unset this
      height: '100%',
      opacity: 0,

      '&:focus + span, &:focus-visible + span': getFocusStyles(theme),

      '&:focus:not(:focus-visible) + span': getMouseFocusStyles(theme),

      /**
       * Using adjacent sibling selector to style checked state.
       * Primarily to limit the classes necessary to use when these classes will be used
       * for angular components styling
       * */
      '&:checked + span': {
        background: theme.colors.primary.main,
        border: `1px solid ${getBorderColor(theme.colors.primary.main)}`,

        '&:hover': {
          background: theme.colors.primary.shade,
        },

        '&:after': {
          content: '""',
          position: 'absolute',
          zIndex: 2,
          left: theme.spacing(0.5),
          top: 0,
          width: theme.spacing(0.75),
          height: theme.spacing(1.5),
          border: `solid ${theme.colors.primary.contrastText}`,
          borderWidth: '0 3px 3px 0',
          transform: 'rotate(45deg)',
        },
      },

      '&:disabled + span': {
        backgroundColor: theme.colors.action.disabledBackground,
        cursor: 'not-allowed',
        border: `1px solid ${getBorderColor(theme.colors.action.disabledBackground)}`,

        '&:hover': {
          backgroundColor: theme.colors.action.disabledBackground,
        },

        '&:after': {
          borderColor: theme.colors.action.disabledText,
        },
      },
    }),

    inputIndeterminate: css({
      "&[aria-checked='mixed'] + span": {
        border: `1px solid ${getBorderColor(theme.colors.primary.main)}`,
        background: theme.colors.primary.main,

        '&:hover': {
          background: theme.colors.primary.shade,
        },

        '&:after': {
          content: '""',
          position: 'absolute',
          zIndex: 2,
          left: '2px',
          right: '2px',
          top: 'calc(50% - 1.5px)',
          height: '3px',
          border: `1.5px solid ${theme.colors.primary.contrastText}`,
          backgroundColor: theme.colors.primary.contrastText,
          width: 'auto',
          transform: 'none',
        },
      },
      "&:disabled[aria-checked='mixed'] + span": {
        backgroundColor: theme.colors.action.disabledBackground,
        border: `1px solid ${getBorderColor(theme.colors.error.transparent)}`,

        '&:after': {
          borderColor: theme.colors.action.disabledText,
        },
      },
    }),

    checkboxWrapper: css({
      display: 'flex',
      alignItems: 'center',
      gridColumnStart: 1,
      gridRowStart: 1,
    }),
    checkmark: css({
      position: 'relative' /* Checkbox should be layered on top of the invisible input so it recieves :hover */,
      zIndex: 2,
      display: 'inline-block',
      width: theme.spacing(checkboxSize),
      height: theme.spacing(checkboxSize),
      borderRadius: theme.shape.radius.default,
      background: theme.components.input.background,
      border: `1px solid ${getBorderColor(theme.components.input.borderColor)}`,

      '&:hover': {
        cursor: 'pointer',
        borderColor: getBorderColor(theme.components.input.borderHover),
      },
    }),
    label: cx(
      labelStyles.label,
      css({
        gridColumnStart: 2,
        gridRowStart: 1,
        position: 'relative',
        zIndex: 2,
        cursor: 'pointer',
        maxWidth: 'fit-content',
        lineHeight: theme.typography.bodySmall.lineHeight,
        marginBottom: 0,
      })
    ),
    description: cx(
      labelStyles.description,
      css({
        gridColumnStart: 2,
        gridRowStart: 2,
        lineHeight: theme.typography.bodySmall.lineHeight,
        marginTop: 0 /* The margin effectively comes from the top: -2px on the label above it */,
        // Enable interacting with description when checkbox is disabled
        zIndex: 1,
      })
    ),
  };
};

Checkbox.displayName = 'Checkbox';
