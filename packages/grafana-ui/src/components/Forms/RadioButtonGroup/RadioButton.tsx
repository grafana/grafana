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
  isHorizontal?: boolean;
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
      isHorizontal = false,
    },
    ref
  ) => {
    const theme = useTheme2();
    const styles = getRadioButtonStyles(theme, size, fullWidth, isHorizontal);

    return (
      <>
        <label className={styles.radioLabel} htmlFor={id} title={description || ariaLabel}>
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
          {children}
        </label>
      </>
    );
  }
);

RadioButton.displayName = 'RadioButton';

const getRadioButtonStyles = stylesFactory(
  (theme: GrafanaTheme2, size: RadioButtonSize, fullWidth?: boolean, isHorizontal?: boolean) => {
    const { fontSize, height, padding } = getPropertiesForButtonSize(size, theme);

    const textColor = theme.colors.text.secondary;
    const textColorHover = theme.colors.text.primary;
    // remove the group inner padding (set on RadioButtonGroup)
    const labelHeight = height * theme.spacing.gridSize - 4 - 2;

    return {
      radio: css({
        position: isHorizontal ? 'absolute' : 'inherit',
        opacity: isHorizontal ? 0 : 'inherit',
        zIndex: isHorizontal ? -1000 : 'inherit',

        'label:has(&:checked)': {
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
        display: isHorizontal ? 'inline-block' : 'grid',
        gridTemplateColumns: isHorizontal ? 'auto' : '16px auto auto',
        gap: isHorizontal ? '0px' : '8px',
        justifyContent: isHorizontal ? 'inherit' : 'start',
        fontSize,
        height: `${labelHeight}px`,
        // Deduct border from line-height for perfect vertical centering on windows and linux
        lineHeight: `${labelHeight}px`,
        color: textColor,
        padding: theme.spacing(0, isHorizontal ? padding : '2px'),
        borderRadius: theme.shape.borderRadius(),
        background: theme.colors.background.primary,
        cursor: 'pointer',
        zIndex: 1,
        flex: fullWidth ? `1 0 0` : 'none',
        textAlign: 'center',
        userSelect: 'none',
        whiteSpace: 'nowrap',

        '&:hover': {
          color: textColorHover,
        },
      }),
    };
  }
);
