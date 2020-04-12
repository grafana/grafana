import React from 'react';
import { useTheme, stylesFactory } from '../../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { getFocusCss, getPropertiesForButtonSize } from '../commonStyles';

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
  const { fontSize, height } = getPropertiesForButtonSize(theme, size);
  const horizontalPadding = theme.spacing[size] ?? theme.spacing.md;
  const c = theme.palette;

  const textColor = theme.isLight ? c.gray33 : c.gray70;
  const textColorHover = theme.isLight ? c.blueShade : c.blueLight;
  const textColorActive = theme.isLight ? c.blueShade : c.blueLight;
  const borderColor = theme.isLight ? c.gray4 : c.gray25;
  const borderColorHover = theme.isLight ? c.gray70 : c.gray33;
  const borderColorActive = theme.isLight ? c.blueShade : c.blueLight;
  const bg = c.pageBg;
  const bgDisabled = theme.isLight ? c.gray95 : c.gray15;
  const bgActive = theme.isLight ? c.white : c.gray05;

  const border = `1px solid ${borderColor}`;
  const borderActive = `1px solid ${borderColorActive}`;
  const borderHover = `1px solid ${borderColorHover}`;
  const fakeBold = `0 0 0.65px ${textColorHover}, 0 0 0.65px ${textColorHover}`;

  return {
    radio: css`
      position: absolute;
      top: 0;
      left: -100vw;
      opacity: 0;
      z-index: -1000;

      &:checked + label {
        border: ${borderActive};
        color: ${textColorActive};
        text-shadow: ${fakeBold};
        background: ${bgActive};
        z-index: 3;
      }

      &:focus + label {
        ${getFocusCss(theme)};
        z-index: 3;
      }

      &:disabled + label {
        cursor: default;
        background: ${bgDisabled};
        color: ${textColor};
      }

      &:enabled + label:hover {
        text-shadow: ${fakeBold};
      }
    `,
    radioLabel: css`
      display: inline-block;
      position: relative;
      font-size: ${fontSize};
      height: ${height};
      line-height: ${height};
      color: ${textColor};
      padding: 0 ${horizontalPadding};
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
