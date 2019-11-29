import React from 'react';
import { useTheme, stylesFactory } from '../../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { getFocusCss, getPropertiesForButtonSize } from '../commonStyles';

type RadioButtonSize = 'sm' | 'md';

interface RadioButtonProps<T> {
  size?: RadioButtonSize;
  active: boolean;
  value: T;
  onClick: (value: T) => void;
}

const getRadioButtonStyles = stylesFactory((theme: GrafanaTheme, size: RadioButtonSize) => {
  const { padding, fontSize, height } = getPropertiesForButtonSize(theme, size);
  return {
    button: css`
      cursor: pointer;
      z-index: 0;
      background: ${theme.colors.formRadioButtonBg};
      border: 1px solid ${theme.colors.formRadioButtonBorder};
      color: ${theme.colors.formRadioButtonText};
      font-size: ${fontSize};
      padding: ${padding};
      height: ${height};
      border-right: none;

      &:hover {
        color: ${theme.colors.formRadioButtonTextHover};
        font-weight: bold;
      }

      &:focus {
        z-index: 1;
        ${getFocusCss(theme)};
      }

      &:first-child {
        border-top-left-radius: ${theme.border.radius.sm};
        border-bottom-left-radius: ${theme.border.radius.sm};
      }
      &:last-child {
        border-top-right-radius: ${theme.border.radius.sm};
        border-bottom-right-radius: ${theme.border.radius.sm};
        border-width: 1;
      }
    `,
    buttonActive: css`
      background: ${theme.colors.formRadioButtonBgActive};
      font-weight: bold;
    `,
  };
});

export function RadioButton<T>({
  value,
  children,
  active = false,
  size = 'md',
  onClick,
}: React.PropsWithChildren<RadioButtonProps<T>>) {
  const theme = useTheme();
  const styles = getRadioButtonStyles(theme, size);

  return (
    <button type="button" className={cx(styles.button, active && styles.buttonActive)} onClick={() => onClick(value)}>
      {children}
    </button>
  );
}
