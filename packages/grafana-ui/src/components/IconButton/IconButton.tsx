import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2, deprecationWarning } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { IconName, IconSize, IconType } from '../../types/icon';
import { ComponentSize } from '../../types/size';
import { getActiveButtonStyles, IconRenderer } from '../Button/Button';
import { getSvgSize } from '../Icon/utils';
import { Tooltip } from '../Tooltip/Tooltip';
import { PopoverContent, TooltipPlacement } from '../Tooltip/types';

export type IconButtonVariant = 'primary' | 'secondary' | 'destructive';

type LimitedIconSize = ComponentSize | 'xl';

interface BaseProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Name of the icon **/
  name: IconName;
  /** Icon size - sizes xxl and xxxl are deprecated and when used being decreased to xl*/
  size?: IconSize;
  /** Type of the icon - mono or default */
  iconType?: IconType;
  /** Variant to change the color of the Icon */
  variant?: IconButtonVariant;
}

export interface BasePropsWithTooltip extends BaseProps {
  /** Tooltip content to display on hover and as the aria-label */
  tooltip: PopoverContent;
  /** Position of the tooltip */
  tooltipPlacement?: TooltipPlacement;
}

interface BasePropsWithAriaLabel extends BaseProps {
  /** @deprecated use aria-label instead*/
  ariaLabel?: string;
  /** Text available only for screen readers. No tooltip will be set in this case. */
  ['aria-label']: string;
}

export type Props = BasePropsWithTooltip | BasePropsWithAriaLabel;

/**
 * This component looks just like an icon but behaves like a button.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-iconbutton--docs
 */
export const IconButton = React.forwardRef<HTMLButtonElement, Props>((props, ref) => {
  const { size = 'md', variant = 'secondary' } = props;
  let limitedIconSize: LimitedIconSize;

  // very large icons (xl to xxxl) are unified to size xl
  if (size === 'xxl' || size === 'xxxl') {
    deprecationWarning('IconButton', 'size="xxl" and size="xxxl"', 'size="xl"');
    limitedIconSize = 'xl';
  } else {
    limitedIconSize = size;
  }

  const styles = useStyles2(getStyles, limitedIconSize, variant);

  let ariaLabel: string | undefined;
  let buttonRef: typeof ref | undefined;

  if ('tooltip' in props) {
    const { tooltip } = props;
    ariaLabel = typeof tooltip === 'string' ? tooltip : undefined;
  } else if ('ariaLabel' in props || 'aria-label' in props) {
    const { ariaLabel: deprecatedAriaLabel, ['aria-label']: ariaLabelProp } = props;
    ariaLabel = ariaLabelProp || deprecatedAriaLabel;
    buttonRef = ref;
  }

  // When using tooltip, ref is forwarded to Tooltip component instead for https://github.com/grafana/grafana/issues/65632
  if ('tooltip' in props) {
    const { name, iconType, className, tooltip, tooltipPlacement, ...restProps } = props;
    return (
      <Tooltip ref={ref} content={tooltip} placement={tooltipPlacement}>
        <button
          {...restProps}
          ref={buttonRef}
          aria-label={ariaLabel}
          className={cx(styles.button, className)}
          type="button"
        >
          <IconRenderer icon={name} size={limitedIconSize} className={styles.icon} iconType={iconType} />
        </button>
      </Tooltip>
    );
  } else {
    const { name, iconType, className, ...restProps } = props;
    return (
      <button
        {...restProps}
        ref={buttonRef}
        aria-label={ariaLabel}
        className={cx(styles.button, className)}
        type="button"
      >
        <IconRenderer icon={name} size={limitedIconSize} className={styles.icon} iconType={iconType} />
      </button>
    );
  }
});

IconButton.displayName = 'IconButton';

const getStyles = (theme: GrafanaTheme2, size: IconSize, variant: IconButtonVariant) => {
  // overall size of the IconButton on hover
  // theme.spacing.gridSize originates from 2*4px for padding and letting the IconSize generally decide on the hoverSize
  const hoverSize = getSvgSize(size) + theme.spacing.gridSize;
  const activeButtonStyle = getActiveButtonStyles(theme.colors.secondary, 'text');

  let iconColor = theme.colors.primary.text;
  let hoverColor = theme.colors.primary.transparent;

  if (variant === 'secondary') {
    iconColor = theme.colors.secondary.text;
    hoverColor = theme.colors.secondary.transparent;
  } else if (variant === 'destructive') {
    iconColor = theme.colors.error.text;
    hoverColor = theme.colors.error.transparent;
  }

  return {
    button: css({
      zIndex: 0,
      position: 'relative',
      margin: `0 ${theme.spacing.x0_5} 0 0`,
      boxShadow: 'none',
      border: 'none',
      display: 'inline-flex',
      background: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 0,
      color: iconColor,
      borderRadius: theme.shape.radius.default,

      '&:active': {
        '&:before, &:hover:before': {
          backgroundColor: activeButtonStyle.background,
        },
      },

      '&[disabled], &:disabled': {
        cursor: 'not-allowed',
        color: theme.colors.action.disabledText,
        opacity: 0.65,
        '&:hover:before': {
          backgroundColor: 'transparent',
        },
      },

      '&:before': {
        zIndex: -1,
        position: 'absolute',
        opacity: 0,
        width: `${hoverSize}px`,
        height: `${hoverSize}px`,
        borderRadius: theme.shape.radius.default,
        content: '""',
        [theme.transitions.handleMotion('no-preference', 'reduce')]: {
          transitionDuration: '0.2s',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          transitionProperty: 'opacity',
        },
      },

      '&:focus, &:focus-visible': getFocusStyles(theme),

      '&:focus:not(:focus-visible)': getMouseFocusStyles(theme),

      '&:hover:before': {
        backgroundColor: hoverColor,
        opacity: 1,
      },
    }),
    icon: css({
      verticalAlign: 'baseline',
    }),
  };
};
