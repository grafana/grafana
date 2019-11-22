import React from 'react';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { getFocusStyle } from './commonStyles';

export interface SwitchProps {
  checked?: boolean;
  disabled?: boolean;
  onChange?: (e: React.SyntheticEvent<HTMLButtonElement>, checked: boolean) => void;
}

export const getSwitchStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    slider: cx(
      css`
        width: 32px;
        height: 16px;
        background: ${theme.colors.formSwitchBg};
        transition: all 0.30s ease;
        border-radius: 50px;
        position: relative;
        border: none;
        display: block;
        padding: 0;
        &:hover {
          background: ${theme.colors.formSwitchBgHover};
        }
        &:after {
          content: '';
          transition: transform 0.2s cubic-bezier(0.19, 1, 0.22, 1);
          position: absolute;
          top: 50%;
          display: block;
          width: 12px;
          height: 12px;
          background: ${theme.colors.formSwitchDot};
          border-radius: 6px;
          transform: translate3d(2px, -50%, 0);
        }
        &:focus {
          /* border: 1px solid ${theme.colors.formSwitchDot}; */
        }
        &[disabled] {
          background: ${theme.colors.formSwitchBgDisabled};
        }
      `,
      getFocusStyle(theme)
    ),
    sliderActive: css`
      background: ${theme.colors.formSwitchBgActive};
      &:hover {
        background: ${theme.colors.formSwitchBgActiveHover};
      }
      &:after {
        transform: translate3d(16px, -50%, 0);
      }
    `,
  };
});
export const Switch: React.FC<SwitchProps> = ({ checked = false, disabled = false, onChange }) => {
  const theme = useTheme();
  const styles = getSwitchStyles(theme);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      disabled={disabled}
      className={cx(styles.slider, checked && styles.sliderActive)}
      onClick={e => {
        if (onChange) {
          onChange(e, !!!checked);
        }
      }}
    />
  );
};
