import React from 'react';
import { useTheme, stylesFactory } from '../../../themes';
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
  const border = `1px solid ${theme.colors.formRadioButtonBorder}`;
  const borderActive = `1px solid ${theme.colors.formRadioButtonBorderActive}`;
  const borderHover = `1px solid ${theme.colors.formRadioButtonBorderHover}`;
  const fakeBold = `0 0 0.65px ${theme.colors.formRadioButtonTextHover},
  0 0 0.65px ${theme.colors.formRadioButtonTextHover}`;

  return {
    button: css`
      cursor: pointer;
      position: relative;
      z-index: 0;
      background: ${theme.colors.formRadioButtonBg};
      border: ${border};
      color: ${theme.colors.formRadioButtonText};
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
          background: ${theme.colors.formRadioButtonBorderHover};
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
        color: ${theme.colors.formRadioButtonTextHover};
        /* The text shadow imitates font-weight:bold;
         * Using font weight on hover makes the button size slighlty change which looks like a glitch
         * */
        text-shadow: ${fakeBold};
      }

      &:focus {
        z-index: 1;
        ${getFocusCss(theme)};
        &:before {
          background: ${theme.colors.formRadioButtonBorder};
        }
        &:hover {
          &:before {
            background: ${theme.colors.formRadioButtonBorderHover};
          }
        }
      }

      &:disabled {
        background: ${theme.colors.formRadioButtonBgDisabled};
        color: ${theme.colors.formRadioButtonText};
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
      background: ${theme.colors.formRadioButtonBgActive};
      border: ${borderActive};
      border-left: none;
      color: ${theme.colors.formRadioButtonTextActive};
      text-shadow: ${fakeBold};

      &:hover {
        border: ${borderActive};
        border-left: none;
      }

      &:focus {
        &:before {
          background: ${theme.colors.formRadioButtonBorderActive};
        }
        &:hover:before {
          background: ${theme.colors.formRadioButtonBorderActive};
        }
      }

      &:before,
      &:hover:before {
        background: ${theme.colors.formRadioButtonBorderActive};
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
        border-color: ${theme.colors.formRadioButtonBorderActive};
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
