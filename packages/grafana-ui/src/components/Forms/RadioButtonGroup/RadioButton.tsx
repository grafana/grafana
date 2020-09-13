import React from 'react';
import { useTheme, stylesFactory } from '../../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { getPropertiesForButtonSize } from '../commonStyles';
import { focusCss } from '../../../themes/mixins';

export type RadioButtonSize = 'sm' | 'md';

export interface RadioButtonProps {
  size?: RadioButtonSize;
  disabled?: boolean;
  name?: string;
  active: boolean;
  id: string;
  onChange: () => void;
  fullWidth?: boolean;
}

const getRadioButtonStyles = stylesFactory((theme: GrafanaTheme, size: RadioButtonSize, fullWidth?: boolean) => {
  const { fontSize, height, padding } = getPropertiesForButtonSize({
    theme,
    size,
    hasIcon: false,
    hasText: true,
    variant: 'secondary',
  });

  const c = theme.palette;
  const textColor = theme.colors.textSemiWeak;
  const textColorHover = theme.colors.text;
  const textColorActive = theme.colors.textBlue;
  const borderColor = theme.colors.border2;
  const borderColorHover = theme.colors.border3;
  const borderColorActive = theme.colors.border2;
  const bg = theme.colors.bodyBg;
  const bgDisabled = theme.isLight ? c.gray95 : c.gray15;
  const bgActive = theme.colors.bg2;

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
        background: ${bgDisabled};
        color: ${textColor};
      }
    `,
    radioLabel: css`
      display: inline-block;
      position: relative;
      font-size: ${fontSize};
      height: ${height}px;
      // Deduct border from line-height for perfect vertical centering on windows and linux
      line-height: ${height - 2}px;
      color: ${textColor};
      padding: ${padding};
      margin-left: -1px;
      border-radius: ${theme.border.radius.sm};
      border: ${border};
      background: ${bg};
      cursor: pointer;
      z-index: 1;
      flex-grow: ${fullWidth ? 1 : 0};
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
      <label className={cx(styles.radioLabel)} htmlFor={id}>
        {children}
      </label>
    </>
  );
};

RadioButton.displayName = 'RadioButton';
