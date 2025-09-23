import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import { forwardRef, HTMLProps, useRef } from 'react';

import { GrafanaTheme2, deprecationWarning } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { Icon } from '../Icon/Icon';

export interface Props extends Omit<HTMLProps<HTMLInputElement>, 'value'> {
  value?: boolean;
  /** Show an invalid state around the input */
  invalid?: boolean;
}

export const Switch = forwardRef<HTMLInputElement, Props>(
  ({ value, checked, onChange, id, label, disabled, invalid = false, ...inputProps }, ref) => {
    if (checked) {
      deprecationWarning('Switch', 'checked prop', 'value');
    }

    const styles = useStyles2(getSwitchStyles);
    const switchIdRef = useRef(id ? id : uniqueId('switch-'));

    return (
      <div className={cx(styles.switch, invalid && styles.invalid)}>
        <input
          type="checkbox"
          role="switch"
          disabled={disabled}
          checked={value}
          onChange={(event) => {
            !disabled && onChange?.(event);
          }}
          id={switchIdRef.current}
          {...inputProps}
          ref={ref}
        />
        <label htmlFor={switchIdRef.current} aria-label={label}>
          <Icon name="check" size="xs" />
        </label>
      </div>
    );
  }
);

Switch.displayName = 'Switch';

export interface InlineSwitchProps extends Props {
  /** Label to show next to the switch */
  showLabel?: boolean;
  /** Make inline switch's background and border transparent */
  transparent?: boolean;
}

export const InlineSwitch = forwardRef<HTMLInputElement, InlineSwitchProps>(
  ({ transparent, className, showLabel, label, value, id, invalid, ...props }, ref) => {
    const styles = useStyles2(getSwitchStyles, transparent);

    return (
      <div
        className={cx(styles.inlineContainer, className, props.disabled && styles.disabled, invalid && styles.invalid)}
      >
        {showLabel && (
          <label
            htmlFor={id}
            className={cx(styles.inlineLabel, value && styles.inlineLabelEnabled, 'inline-switch-label')}
          >
            {label}
          </label>
        )}
        <Switch {...props} id={id} label={label} ref={ref} value={value} />
      </div>
    );
  }
);

InlineSwitch.displayName = 'Switch';

const getSwitchStyles = (theme: GrafanaTheme2, transparent?: boolean) => ({
  switch: css({
    width: theme.spacing(4),
    height: theme.spacing(2),
    position: 'relative',
    lineHeight: 1,

    input: {
      height: '100%',
      width: '100% !important',
      opacity: 0,
      zIndex: -1000,
      position: 'absolute',

      '&:checked + label': {
        background: theme.colors.primary.main,
        borderColor: theme.colors.primary.main,

        '&:hover': {
          background: theme.colors.primary.shade,
        },

        svg: {
          transform: `translate3d(${theme.spacing(2.25)}, -50%, 0)`,
          background: theme.colors.primary.contrastText,
          color: theme.colors.primary.main,
        },
      },

      '&:disabled + label': {
        background: theme.colors.action.disabledBackground,
        borderColor: theme.colors.border.weak,
        cursor: 'not-allowed',

        svg: {
          background: theme.colors.text.disabled,
        },
      },

      '&:disabled:checked + label': {
        background: theme.colors.primary.transparent,

        svg: {
          color: theme.colors.primary.contrastText,
        },
      },

      '&:focus + label, &:focus-visible + label': getFocusStyles(theme),

      '&:focus:not(:focus-visible) + label': getMouseFocusStyles(theme),
    },

    label: {
      width: '100%',
      height: '100%',
      cursor: 'pointer',
      borderRadius: theme.shape.radius.pill,
      background: theme.components.input.background,
      border: `1px solid ${theme.components.input.borderColor}`,
      transition: 'all 0.3s ease',

      '&:hover': {
        borderColor: theme.components.input.borderHover,
      },

      svg: {
        position: 'absolute',
        display: 'block',
        color: 'transparent',
        width: theme.spacing(1.5),
        height: theme.spacing(1.5),
        borderRadius: theme.shape.radius.circle,
        background: theme.colors.text.secondary,
        boxShadow: theme.shadows.z1,
        left: 0,
        top: '50%',
        transform: `translate3d(${theme.spacing(0.25)}, -50%, 0)`,
        transition: 'transform 0.2s cubic-bezier(0.19, 1, 0.22, 1)',

        '@media (forced-colors: active)': {
          border: `1px solid ${theme.colors.primary.contrastText}`,
        },
      },
    },
  }),
  inlineContainer: css({
    padding: theme.spacing(0, 1),
    height: theme.spacing(theme.components.height.md),
    display: 'inline-flex',
    alignItems: 'center',
    background: transparent ? 'transparent' : theme.components.input.background,
    border: `1px solid ${transparent ? 'transparent' : theme.components.input.borderColor}`,
    borderRadius: theme.shape.radius.default,

    '&:hover': {
      border: `1px solid ${transparent ? 'transparent' : theme.components.input.borderHover}`,

      '.inline-switch-label': {
        color: theme.colors.text.primary,
      },
    },
  }),
  disabled: css({
    backgroundColor: 'rgba(204, 204, 220, 0.04)',
    color: 'rgba(204, 204, 220, 0.6)',
    border: '1px solid rgba(204, 204, 220, 0.04)',
  }),
  inlineLabel: css({
    cursor: 'pointer',
    paddingRight: theme.spacing(1),
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
  }),
  inlineLabelEnabled: css({
    color: theme.colors.text.primary,
  }),
  invalid: css({
    'input + label, input:checked + label, input:hover + label': {
      border: `1px solid ${theme.colors.error.border}`,
    },
  }),
});
