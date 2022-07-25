import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes';

export interface RadioButtonDotProps {
  id: string;
  name: string;
  checked?: boolean;
  disabled?: boolean;
  label: React.ReactNode;
  description?: string;
  onChange?: (id: string) => void;
}

export const RadioButtonDot = ({ id, name, label, checked, disabled, description, onChange }: RadioButtonDotProps) => {
  const styles = useStyles2(getStyles);

  return (
    <label title={description} className={styles.label}>
      <input
        id={id}
        name={name}
        type="radio"
        checked={checked}
        disabled={disabled}
        className={styles.input}
        onChange={() => onChange && onChange(id)}
      />
      {label}
    </label>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  input: css`
    position: relative;
    appearance: none;
    outline: none;
    background-color: ${theme.colors.background.canvas};
    margin: 0;
    width: ${theme.spacing(2)} !important; /* TODO How to overcome this? Checkbox does the same 🙁 */
    height: ${theme.spacing(2)};
    border: 1px solid ${theme.colors.border.medium};
    border-radius: 50%;
    margin: 3px 0; /* Space for box-shadow when focused */

    :checked {
      background-color: ${theme.v1.palette.white};
      border: 5px solid ${theme.colors.primary.main};
    }

    :disabled {
      background-color: ${theme.colors.action.disabledBackground} !important;
      border-color: ${theme.colors.border.weak};
    }

    :disabled:checked {
      border: 1px solid ${theme.colors.border.weak};
    }

    :disabled:checked::after {
      content: '';
      width: 6px;
      height: 6px;
      background-color: ${theme.colors.text.disabled};
      border-radius: 50%;
      display: inline-block;
      position: absolute;
      top: 4px;
      left: 4px;
    }

    :focus {
      outline: none !important;
      box-shadow: 0 0 0 1px ${theme.colors.background.canvas}, 0 0 0 3px ${theme.colors.primary.main};
    }
  `,
  label: css`
    font-size: ${theme.typography.fontSize};
    line-height: 22px; /* 16px for the radio button and 6px for the focus shadow */
    display: grid;
    grid-template-columns: ${theme.spacing(2)} auto;
    gap: ${theme.spacing(1)};
  `,
});
