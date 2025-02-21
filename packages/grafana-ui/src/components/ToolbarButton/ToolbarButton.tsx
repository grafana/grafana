import { cx, css } from '@emotion/css';
import { forwardRef, ButtonHTMLAttributes } from 'react';
import * as React from 'react';

import { GrafanaTheme2, IconName, isIconName } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { styleMixins, useStyles2 } from '../../themes';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { IconSize } from '../../types/icon';
import { getPropertiesForVariant } from '../Button';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip';

type CommonProps = {
  /** Icon name */
  icon?: IconName | React.ReactNode;
  /** Icon size */
  iconSize?: IconSize;
  /** Tooltip */
  tooltip?: string;
  /** For image icons */
  imgSrc?: string;
  /** Alt text for imgSrc */
  imgAlt?: string;
  /** if true or false will show angle-down/up */
  isOpen?: boolean;
  /** Controls flex-grow: 1 */
  fullWidth?: boolean;
  /** reduces padding to xs */
  narrow?: boolean;
  /** variant */
  variant?: ToolbarButtonVariant;
  /** Hide any children and only show icon */
  iconOnly?: boolean;
  /** Show highlight dot */
  isHighlighted?: boolean;
};

export type ToolbarButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export type ToolbarButtonVariant = 'default' | 'primary' | 'destructive' | 'active' | 'canvas';

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      tooltip,
      icon,
      iconSize,
      className,
      children,
      imgSrc,
      imgAlt,
      fullWidth,
      isOpen,
      narrow,
      variant = 'default',
      iconOnly,
      'aria-label': ariaLabel,
      isHighlighted,
      ...rest
    },
    ref
  ) => {
    const styles = useStyles2(getStyles);

    const buttonStyles = cx(
      {
        [styles.button]: true,
        [styles.buttonFullWidth]: fullWidth,
        [styles.narrow]: narrow,
      },
      styles[variant],
      className
    );

    const contentStyles = cx({
      [styles.content]: true,
      [styles.contentWithIcon]: !!icon,
      [styles.contentWithRightIcon]: isOpen !== undefined,
    });

    const body = (
      <button
        ref={ref}
        className={buttonStyles}
        aria-label={getButtonAriaLabel(ariaLabel, tooltip)}
        aria-expanded={isOpen}
        {...rest}
      >
        {renderIcon(icon, iconSize)}
        {imgSrc && <img className={styles.img} src={imgSrc} alt={imgAlt ?? ''} />}
        {children && !iconOnly && <div className={contentStyles}>{children}</div>}
        {isOpen === false && <Icon name="angle-down" />}
        {isOpen === true && <Icon name="angle-up" />}
        {isHighlighted && <div className={styles.highlight} />}
      </button>
    );

    return tooltip ? (
      <Tooltip ref={ref} content={tooltip} placement="bottom">
        {body}
      </Tooltip>
    ) : (
      body
    );
  }
);

ToolbarButton.displayName = 'ToolbarButton';

function getButtonAriaLabel(ariaLabel: string | undefined, tooltip: string | undefined) {
  return ariaLabel ? ariaLabel : tooltip ? selectors.components.PageToolbar.item(tooltip) : undefined;
}

function renderIcon(icon: IconName | React.ReactNode, iconSize?: IconSize) {
  if (!icon) {
    return null;
  }

  if (isIconName(icon)) {
    return <Icon name={icon} size={`${iconSize ? iconSize : 'lg'}`} />;
  }

  return icon;
}

const getStyles = (theme: GrafanaTheme2) => {
  const primaryVariant = getPropertiesForVariant(theme, 'primary', 'solid');
  const destructiveVariant = getPropertiesForVariant(theme, 'destructive', 'solid');

  const defaultOld = css({
    color: theme.colors.text.primary,
    background: theme.colors.secondary.main,

    '&:hover': {
      color: theme.colors.text.primary,
      background: theme.colors.secondary.shade,
      border: `1px solid ${theme.colors.border.medium}`,
    },
  });

  return {
    button: css({
      label: 'toolbar-button',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      height: theme.spacing(theme.components.height.md),
      padding: theme.spacing(0, 1),
      borderRadius: theme.shape.radius.default,
      lineHeight: `${theme.components.height.md * theme.spacing.gridSize - 2}px`,
      fontWeight: theme.typography.fontWeightMedium,
      border: `1px solid ${theme.colors.secondary.border}`,
      whiteSpace: 'nowrap',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background', 'box-shadow', 'border-color', 'color'], {
          duration: theme.transitions.duration.short,
        }),
      },

      [theme.breakpoints.down('md')]: {
        width: 'auto !important',
      },

      '&:focus, &:focus-visible': {
        ...getFocusStyles(theme),
        zIndex: 1,
      },

      '&:focus:not(:focus-visible)': getMouseFocusStyles(theme),

      '&[disabled], &:disabled': {
        cursor: 'not-allowed',
        opacity: theme.colors.action.disabledOpacity,
        background: theme.colors.action.disabledBackground,
        boxShadow: 'none',

        '&:hover': {
          color: theme.colors.text.disabled,
          background: theme.colors.action.disabledBackground,
          boxShadow: 'none',
        },
      },
    }),
    default: css({
      color: theme.colors.text.secondary,
      background: 'transparent',
      border: `1px solid transparent`,

      '&:hover': {
        color: theme.colors.text.primary,
        background: theme.colors.action.hover,
      },
    }),
    canvas: defaultOld,
    active: cx(
      defaultOld,
      css({
        '&::before': {
          display: 'block',
          content: '" "',
          position: 'absolute',
          left: 0,
          right: 0,
          height: '2px',
          bottom: 0,
          borderRadius: theme.shape.radius.default,
          backgroundImage: theme.colors.gradients.brandHorizontal,
        },
      })
    ),
    primary: css(primaryVariant),
    destructive: css(destructiveVariant),
    narrow: css({
      padding: theme.spacing(0, 0.5),
    }),
    img: css({
      width: '16px',
      height: '16px',
      marginRight: theme.spacing(1),
    }),
    buttonFullWidth: css({
      flexGrow: 1,
    }),
    content: css({
      display: 'flex',
      flexGrow: 1,
    }),
    contentWithIcon: css({
      display: 'none',
      paddingLeft: theme.spacing(1),

      [`@media ${styleMixins.mediaUp(theme.v1.breakpoints.md)}`]: {
        display: 'block',
      },
    }),
    contentWithRightIcon: css({
      paddingRight: theme.spacing(0.5),
    }),
    highlight: css({
      backgroundColor: theme.colors.success.main,
      borderRadius: theme.shape.radius.circle,
      width: '6px',
      height: '6px',
      position: 'absolute',
      top: '-3px',
      right: '-3px',
      zIndex: 1,
    }),
  };
};
