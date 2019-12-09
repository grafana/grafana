import React from 'react';
import { useTheme, stylesFactory, selectThemeVariant as stv } from '../../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { getFocusCss, getPropertiesForButtonSize } from '../commonStyles';

export type RadioButtonSize = 'sm' | 'md';
export interface RadioButtonProps {
  size?: RadioButtonSize;
  disabled?: boolean;
  active: boolean;
  onClick: () => void;
}

const getRadioButtonStyles = stylesFactory((theme: GrafanaTheme, size: RadioButtonSize) => {
  const { padding, fontSize, height } = getPropertiesForButtonSize(theme, size);
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
    button: css`
      cursor: pointer;
      position: relative;
      z-index: 0;
      background: ${bg};
      border: ${border};
      color: ${textColor};
      font-size: ${fontSize};
      padding: ${padding};
      height: ${height};
      border-left: 0;

      /* This pseudo element is responsible for rendering the lines between buttons when they are groupped */
      &:before {
        content: '';
        position: absolute;
        top: -1px;
        left: -1px;
        width: 1px;
        height: calc(100% + 2px);
      }

      &:hover {
        border: ${borderHover};
        border-left: 0;
        &:before {
          /* renders line between elements */
          background: ${borderColorHover};
        }
        &:first-child {
          border-left: ${borderHover};
        }
        &:last-child {
          border-right: ${borderHover};
        }
        &:first-child:before {
          /* Don't render divider line on first element*/
          display: none;
        }
      }

      &:not(:disabled):hover {
        color: ${textColorHover};
        /* The text shadow imitates font-weight:bold;
         * Using font weight on hover makes the button size slighlty change which looks like a glitch
         * */
        text-shadow: ${fakeBold};
      }

      &:focus {
        z-index: 1;
        ${getFocusCss(theme)};
        &:before {
          background: ${borderColor};
        }
        &:hover {
          &:before {
            background: ${borderColorHover};
          }
        }
      }

      &:disabled {
        background: ${bgDisabled};
        color: ${textColor};
      }

      &:first-child {
        border-top-left-radius: ${theme.border.radius.sm};
        border-bottom-left-radius: ${theme.border.radius.sm};
        border-left: ${border};
      }
      &:last-child {
        border-top-right-radius: ${theme.border.radius.sm};
        border-bottom-right-radius: ${theme.border.radius.sm};
        border-right: ${border};
      }
    `,

    buttonActive: css`
      background: ${bgActive};
      border: ${borderActive};
      border-left: none;
      color: ${textColorActive};
      text-shadow: ${fakeBold};

      &:hover {
        border: ${borderActive};
        border-left: none;
      }

      &:focus {
        &:before {
          background: ${borderColorActive};
        }
        &:hover:before {
          background: ${borderColorActive};
        }
      }

      &:before,
      &:hover:before {
        background: ${borderColorActive};
      }

      &:first-child,
      &:first-child:hover {
        border-left: ${borderActive};
      }
      &:last-child,
      &:last-child:hover {
        border-right: ${borderActive};
      }

      &:first-child {
        &:before {
          display: none;
        }
      }

      & + button:hover {
        &:before {
          display: none;
        }
      }
      &:focus {
        border-color: ${borderActive};
      }
    `,
  };
});

export const RadioButton: React.FC<RadioButtonProps> = ({
  children,
  active = false,
  disabled = false,
  size = 'md',
  onClick,
}) => {
  const theme = useTheme();
  const styles = getRadioButtonStyles(theme, size);

  return (
    <button
      type="button"
      className={cx(styles.button, active && styles.buttonActive)}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

RadioButton.displayName = 'RadioButton';
