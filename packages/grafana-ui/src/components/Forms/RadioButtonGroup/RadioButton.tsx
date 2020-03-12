import React from 'react';
import { useTheme, stylesFactory, selectThemeVariant as stv } from '../../../themes';
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
}

const getRadioButtonStyles = stylesFactory((theme: GrafanaTheme, size: RadioButtonSize) => {
  const { fontSize, height } = getPropertiesForButtonSize(theme, size);
  const horizontalPadding = theme.spacing[size] ?? theme.spacing.md;
  const c = theme.colors;

  const textColor = stv({ light: c.gray33, dark: c.gray70 }, theme.type);
  const textColorHover = stv({ light: c.blueShade, dark: c.blueLight }, theme.type);
  const textColorActive = stv({ light: c.blueShade, dark: c.blueLight }, theme.type);
  const borderColor = stv({ light: c.gray4, dark: c.gray25 }, theme.type);
  const borderColorHover = stv({ light: c.gray70, dark: c.gray33 }, theme.type);
  const borderColorActive = stv({ light: c.blueShade, dark: c.blueLight }, theme.type);
  const bg = stv({ light: c.gray98, dark: c.gray10 }, theme.type);
  const bgDisabled = stv({ light: c.gray95, dark: c.gray15 }, theme.type);
  const bgActive = stv({ light: c.white, dark: c.gray05 }, theme.type);

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
      min-height: ${fontSize};
      color: ${textColor};
      padding: calc((${height} - ${fontSize}) / 2) ${horizontalPadding} calc((${height} - ${fontSize}) / 2)
        ${horizontalPadding};
      line-height: 1;
      margin-left: -1px;
      border-radius: ${theme.border.radius.sm};
      border: ${border};
      background: ${bg};
      cursor: pointer;
      z-index: 1;

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
}) => {
  const theme = useTheme();
  const styles = getRadioButtonStyles(theme, size);

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
