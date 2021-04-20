import React from 'react';
import { useTheme, stylesFactory } from '../../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { getPropertiesForButtonSize } from '../commonStyles';
import { getFocusStyles, getMouseFocusStyles } from '../../../themes/mixins';

export type RadioButtonSize = 'sm' | 'md';

export interface RadioButtonProps {
  size?: RadioButtonSize;
  disabled?: boolean;
  name?: string;
  description?: string;
  active: boolean;
  id: string;
  onChange: () => void;
  fullWidth?: boolean;
}

export const RadioButton: React.FC<RadioButtonProps> = ({
  children,
  active = false,
  disabled = false,
  size = 'md',
  onChange,
  id,
  name = undefined,
  description,
  fullWidth,
}) => {
  const theme = useTheme();
  const styles = getRadioButtonStyles(theme, size, fullWidth);

  return (
    <>
      <input
        type="radio"
        className={cx(styles.radio)}
        onChange={onChange}
        disabled={disabled}
        id={id}
        checked={active}
        name={name}
      />
      <label className={cx(styles.radioLabel)} htmlFor={id} title={description}>
        {children}
      </label>
    </>
  );
};

RadioButton.displayName = 'RadioButton';

const getRadioButtonStyles = stylesFactory((theme: GrafanaTheme, size: RadioButtonSize, fullWidth?: boolean) => {
  const { fontSize, height, padding } = getPropertiesForButtonSize(size, theme.v2);

  const textColor = theme.v2.palette.text.secondary;
  const textColorHover = theme.v2.palette.text.primary;
  const bg = theme.v2.components.input.background;
  // remove the group inner padding (set on RadioButtonGroup)
  const labelHeight = height * theme.v2.spacing.gridSize - 4;

  return {
    radio: css`
      position: absolute;
      opacity: 0;
      z-index: -1000;

      &:checked + label {
        color: ${theme.v2.palette.text.primary};
        font-weight: ${theme.v2.typography.fontWeightMedium};
        background: ${theme.v2.palette.action.selected};
        z-index: 3;
      }

      &:focus + label,
      &:focus-visible + label {
        ${getFocusStyles(theme.v2)};
      }

      &:focus:not(:focus-visible) + label {
        ${getMouseFocusStyles(theme.v2)}
      }

      &:disabled + label {
        cursor: default;
        color: ${theme.v2.palette.text.disabled};
        cursor: not-allowed;
      }
    `,
    radioLabel: css`
      display: inline-block;
      position: relative;
      font-size: ${fontSize};
      height: ${labelHeight}px;
      // Deduct border from line-height for perfect vertical centering on windows and linux
      line-height: ${labelHeight - 2}px;
      color: ${textColor};
      padding: ${theme.v2.spacing(0, padding)};
      border-radius: ${theme.v2.shape.borderRadius()};
      background: ${bg};
      cursor: pointer;
      z-index: 1;
      flex: ${fullWidth ? `1 0 0` : 'none'};
      text-align: center;
      user-select: none;

      &:hover {
        color: ${textColorHover};
      }
    `,
  };
});
