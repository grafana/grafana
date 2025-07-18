import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { StringSelector, selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../../themes/ThemeContext';
import { getFocusStyles, getInternalRadius, getMouseFocusStyles } from '../../../themes/mixins';
import { Tooltip } from '../../Tooltip/Tooltip';
import { getPropertiesForButtonSize } from '../commonStyles';

export const RADIO_GROUP_PADDING = 2;
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
    const styles = useStyles2(getRadioButtonStyles, size, fullWidth);

    const inputRadioButton = (
      <input
        type="radio"
        className={styles.radio}
        onChange={onChange}
        onClick={onClick}
        disabled={disabled}
        id={id}
        checked={active}
        name={name}
        aria-label={ariaLabel}
        ref={ref}
      />
    );
    return description ? (
      <div className={styles.radioOption} data-testid={selectors.components.RadioButton.container}>
        <Tooltip content={description} placement="bottom">
          {inputRadioButton}
        </Tooltip>
        <label className={styles.radioLabel} htmlFor={id} title={description || ariaLabel}>
          {children}
        </label>
      </div>
    ) : (
      <div className={styles.radioOption} data-testid={selectors.components.RadioButton.container}>
        {inputRadioButton}
        <label className={styles.radioLabel} htmlFor={id} title={description || ariaLabel}>
          {children}
        </label>
      </div>
    );
  }
);

RadioButton.displayName = 'RadioButton';

const getRadioButtonStyles = (theme: GrafanaTheme2, size: RadioButtonSize, fullWidth?: boolean) => {
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
      zIndex: 2,
      width: '100% !important',
      height: '100%',
      cursor: 'pointer',

      '&:checked + label': {
        color: theme.colors.text.primary,
        fontWeight: theme.typography.fontWeightMedium,
        background: theme.colors.action.selected,
        zIndex: 1,
      },

      '&:focus + label, &:focus-visible + label': getFocusStyles(theme),

      '&:focus:not(:focus-visible) + label': getMouseFocusStyles(theme),

      '&:disabled + label': {
        color: theme.colors.text.disabled,
        cursor: 'not-allowed',
      },
    }),
    radioLabel: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize,
      height: `${labelHeight}px`,
      // Deduct border from line-height for perfect vertical centering on windows and linux
      lineHeight: `${labelHeight}px`,
      color: textColor,
      padding: theme.spacing(0, padding),
      borderRadius: getInternalRadius(theme, RADIO_GROUP_PADDING),
      background: theme.colors.background.primary,
      cursor: 'pointer',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      flexGrow: 1,

      '&:hover': {
        color: textColorHover,
      },
    }),
  };
};
