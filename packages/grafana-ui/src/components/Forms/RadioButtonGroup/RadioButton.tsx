import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { StringSelector } from '@grafana/e2e-selectors';

import { useTheme2, stylesFactory } from '../../../themes';
import { getFocusStyles, getMouseFocusStyles } from '../../../themes/mixins';
import { getPropertiesForButtonSize } from '../commonStyles';

export type RadioButtonSize = 'sm' | 'md';

export interface RadioButtonProps {
  size?: RadioButtonSize;
  disabled?: boolean;
  name?: string;
  description?: string;
  active: boolean;
  id: string;
  onChange: () => void;
  onClick: () => void;
  fullWidth?: boolean;
  'aria-label'?: StringSelector;
  children?: React.ReactNode;
}

export const RadioButton = React.forwardRef<HTMLInputElement, RadioButtonProps>(
  (
    {
      children,
      active = false,
      disabled = false,
      size = 'md',
      onChange,
      onClick,
      id,
      name = undefined,
      description,
      fullWidth,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const theme = useTheme2();
    const styles = getRadioButtonStyles(theme, size, fullWidth);

    return (
      <div className={styles.radioOption}>
        <input
          type="radio"
          className={styles.radio}
          onChange={onChange}
          onClick={onClick}
          disabled={disabled}
          id={id}
          checked={active}
          name={name}
          aria-label={ariaLabel || description}
          ref={ref}
        />
        <label className={styles.radioLabel} htmlFor={id} title={description || ariaLabel}>
          {children}
        </label>
      </div>
    );
  }
);

RadioButton.displayName = 'RadioButton';

const getRadioButtonStyles = stylesFactory((theme: GrafanaTheme2, size: RadioButtonSize, fullWidth?: boolean) => {
  const { fontSize, height, padding } = getPropertiesForButtonSize(size, theme);

  const textColor = theme.colors.text.secondary;
  const textColorHover = theme.colors.text.primary;
  // remove the group inner padding (set on RadioButtonGroup)
  const labelHeight = height * theme.spacing.gridSize - 4 - 2;

  return {
    radioOption: css({
      display: 'flex',
      justifyContent: 'space-between',
      position: 'relative',
      flex: fullWidth ? `1 0 0` : 'none',
      textAlign: 'center',
    }),
    radio: css({
      position: 'absolute',
      opacity: 0,
      zIndex: -1000,
      width: '100% !important',
      height: '100%',

      '&:checked + label': {
        color: theme.colors.text.primary,
        fontWeight: theme.typography.fontWeightMedium,
        background: theme.colors.action.selected,
        zIndex: 3,
      },

      '&:focus + label, &:focus-visible + label': getFocusStyles(theme),

      '&:focus:not(:focus-visible) + label': getMouseFocusStyles(theme),

      '&:disabled + label': {
        color: theme.colors.text.disabled,
        cursor: 'not-allowed',
      },
    }),
    radioLabel: css({
      fontSize,
      height: `${labelHeight}px`,
      // Deduct border from line-height for perfect vertical centering on windows and linux
      lineHeight: `${labelHeight}px`,
      color: textColor,
      padding: theme.spacing(0, padding),
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
      cursor: 'pointer',
      zIndex: 1,
      userSelect: 'none',
      whiteSpace: 'nowrap',
      flexGrow: 1,

      '&:hover': {
        color: textColorHover,
      },
    }),
  };
});
