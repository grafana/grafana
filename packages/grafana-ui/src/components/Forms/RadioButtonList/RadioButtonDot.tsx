import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';

export interface RadioButtonDotProps<T>
  extends Omit<React.HTMLProps<HTMLInputElement>, 'label' | 'value' | 'onChange' | 'type'> {
  id: string;
  name: string;
  checked?: boolean;
  value?: T;
  disabled?: boolean;
  label: React.ReactNode;
  description?: string;
  onChange?: (id: string) => void;
}

export const RadioButtonDot = <T extends string | number | readonly string[]>({
  id,
  name,
  label,
  checked,
  value,
  disabled,
  description,
  onChange,
  ...props
}: RadioButtonDotProps<T>) => {
  const styles = useStyles2(getStyles);

  return (
    <label title={description} className={styles.label}>
      <input
        {...props}
        id={id}
        name={name}
        type="radio"
        checked={checked}
        value={value}
        disabled={disabled}
        className={styles.input}
        onChange={() => onChange && onChange(id)}
      />
      <div>
        {label}
        {description && <div className={styles.description}>{description}</div>}
      </div>
    </label>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  input: css({
    position: 'relative',
    appearance: 'none',
    outline: 'none',
    backgroundColor: theme.colors.background.canvas,
    width: `${theme.spacing(2)} !important` /* TODO How to overcome this? Checkbox does the same 🙁 */,
    height: theme.spacing(2),
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.circle,
    cursor: 'pointer',
    margin: '3px 0' /* Space for box-shadow when focused */,

    ':checked': {
      backgroundColor: theme.v1.palette.white,
      border: `5px solid ${theme.colors.primary.main}`,
    },

    ':disabled': {
      backgroundColor: `${theme.colors.action.disabledBackground} !important`,
      borderColor: theme.colors.border.weak,
    },

    ':disabled:checked': {
      border: `1px solid ${theme.colors.border.weak}`,
    },

    ':disabled:checked::after': {
      content: '""',
      width: '6px',
      height: '6px',
      backgroundColor: theme.colors.text.disabled,
      borderRadius: theme.shape.radius.circle,
      display: 'inline-block',
      position: 'absolute',
      top: '4px',
      left: '4px',
    },

    ':focus': {
      outline: 'none !important',
      boxShadow: `0 0 0 1px ${theme.colors.background.canvas}, 0 0 0 3px ${theme.colors.primary.main}`,
    },
  }),
  label: css({
    fontSize: theme.typography.fontSize,
    lineHeight: '22px' /* 16px for the radio button and 6px for the focus shadow */,
    display: 'grid',
    gridTemplateColumns: `${theme.spacing(2)} auto`,
    gap: theme.spacing(1),
    cursor: 'pointer',
  }),
  description: css({
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
  }),
});
