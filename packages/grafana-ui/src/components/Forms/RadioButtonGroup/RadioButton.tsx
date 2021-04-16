import React from 'react';
import { useTheme, stylesFactory } from '../../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { getPropertiesForButtonSize } from '../commonStyles';
import { focusCss } from '../../../themes/mixins';

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

const getRadioButtonStyles = stylesFactory((theme: GrafanaTheme, size: RadioButtonSize, fullWidth?: boolean) => {
  const { fontSize, height, padding } = getPropertiesForButtonSize(size, theme.v2);

  const textColor = theme.v2.palette.text.secondary;
  const textColorHover = theme.v2.palette.text.primary;
  const textColorActive = theme.v2.palette.primary.text;
  const borderColor = theme.v2.components.form.border;
  const borderColorHover = theme.v2.components.form.borderHover;
  const borderColorActive = theme.v2.components.form.border;
  const bg = theme.colors.bodyBg;
  const bgActive = theme.v2.palette.layer2;
  const border = `1px solid ${borderColor}`;
  const borderActive = `1px solid ${borderColorActive}`;
  const borderHover = `1px solid ${borderColorHover}`;

  return {
    radio: css`
      position: absolute;
      opacity: 0;
      z-index: -1000;

      &:checked + label {
        border: ${borderActive};
        color: ${textColorActive};
        background: ${bgActive};
        z-index: 3;
      }

      &:focus + label {
        ${focusCss(theme)};
        z-index: 3;
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
      height: ${theme.v2.spacing(height)};
      // Deduct border from line-height for perfect vertical centering on windows and linux
      line-height: ${theme.v2.spacing.gridSize * height - 2}px;
      color: ${textColor};
      padding: ${theme.v2.spacing(0, padding)};
      margin-left: -1px;
      border-radius: ${theme.border.radius.sm};
      border: ${border};
      background: ${bg};
      cursor: pointer;
      z-index: 1;
      flex: ${fullWidth ? `1 0 0` : 'none'};
      text-align: center;
      user-select: none;

      &:hover {
        color: ${textColorHover};
        border: ${borderHover};
        z-index: 2;
      }
    `,
  };
});

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
