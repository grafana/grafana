import { css, cx } from '@emotion/css';
import { type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import * as React from 'react';

import { colorManipulator, type GrafanaTheme2, textUtil, type ThemeRichColor } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { getButtonFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { type IconName, type IconSize, type IconType } from '../../types/icon';
import { type ComponentSize } from '../../types/size';
import { getPropertiesForButtonSize } from '../Forms/commonStyles';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { type PopoverContent, type TooltipPlacement } from '../Tooltip/types';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'destructive' | 'success';
export const allButtonVariants: ButtonVariant[] = ['primary', 'secondary', 'accent', 'destructive', 'success'];
export type ButtonFill = 'solid' | 'outline' | 'text';
export const allButtonFills: ButtonFill[] = ['solid', 'outline', 'text'];

type BaseProps = {
  size?: ComponentSize;
  variant?: ButtonVariant;
  fill?: ButtonFill;
  icon?: IconName | React.ReactElement<IconElementProps>;
  className?: string;
  fullWidth?: boolean;
  type?: string;
  tooltip?: PopoverContent;
  tooltipPlacement?: TooltipPlacement;
  /** Position of the icon */
  iconPlacement?: 'left' | 'right';
};

// either aria-label or tooltip is required for buttons without children
type NoChildrenAriaLabel = BaseProps & {
  children?: never;
  'aria-label': string;
};
type NoChildrenTooltip = BaseProps & {
  children?: never;
  tooltip: PopoverContent;
  tooltipPlacement?: TooltipPlacement;
};

type BasePropsWithChildren = BaseProps & {
  children: React.ReactNode;
};

type CommonProps = BasePropsWithChildren | NoChildrenTooltip | NoChildrenAriaLabel;

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-button--docs
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      size = 'md',
      fill = 'solid',
      variant = fill === 'text' ? 'accent' : 'primary',
      icon,
      fullWidth,
      children,
      className,
      type = 'button',
      tooltip,
      disabled,
      tooltipPlacement,
      iconPlacement = 'left',
      onClick,
      ...otherProps
    },
    ref
  ) => {
    const theme = useTheme2();
    const styles = getButtonStyles({
      theme,
      size,
      variant,
      fill,
      fullWidth,
      iconOnly: !children,
    });

    const buttonStyles = cx(
      styles.button,
      {
        [styles.disabled]: disabled,
      },
      className
    );

    const hasTooltip = Boolean(tooltip);

    const iconComponent = icon && <IconRenderer icon={icon} size={size} className={styles.icon} />;

    // In order to standardise Button please always consider using IconButton when you need a button with an icon only
    // When using tooltip, ref is forwarded to Tooltip component instead for https://github.com/grafana/grafana/issues/65632
    const button = (
      <button
        className={buttonStyles}
        type={type}
        onClick={disabled ? undefined : onClick}
        {...otherProps}
        // In order for the tooltip to be accessible when disabled,
        // we need to set aria-disabled instead of the native disabled attribute
        aria-disabled={hasTooltip && disabled}
        disabled={!hasTooltip && disabled}
        ref={tooltip ? undefined : ref}
        aria-label={ariaLabel ?? (!children && typeof tooltip === 'string' ? tooltip : undefined)}
      >
        {iconPlacement === 'left' && iconComponent}
        {children && <span className={styles.content}>{children}</span>}
        {iconPlacement === 'right' && iconComponent}
      </button>
    );

    if (tooltip) {
      return (
        <Tooltip ref={ref} content={tooltip} placement={tooltipPlacement}>
          {button}
        </Tooltip>
      );
    }

    return button;
  }
);

Button.displayName = 'Button';

export type ButtonLinkProps = ButtonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'aria-label'>;

export const LinkButton = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (
    {
      'aria-label': ariaLabel,
      variant = 'primary',
      size = 'md',
      fill = 'solid',
      icon,
      iconPlacement = 'left',
      fullWidth,
      children,
      className,
      onBlur,
      onFocus,
      disabled,
      tooltip,
      tooltipPlacement,
      href,
      ...otherProps
    },
    ref
  ) => {
    const sanitizedHref = href ? textUtil.sanitizeUrl(href) : href;

    const theme = useTheme2();
    const styles = getButtonStyles({
      theme,
      fullWidth,
      size,
      variant,
      fill,
      iconOnly: !children,
    });

    const linkButtonStyles = cx(
      styles.button,
      {
        [css(styles.disabled, {
          pointerEvents: 'none',
        })]: disabled,
      },
      className
    );

    const iconComponent = icon && <IconRenderer icon={icon} size={size} className={styles.icon} />;

    // When using tooltip, ref is forwarded to Tooltip component instead for https://github.com/grafana/grafana/issues/65632
    const button = (
      <a
        className={linkButtonStyles}
        {...otherProps}
        href={sanitizedHref}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        ref={tooltip ? undefined : ref}
        aria-label={ariaLabel ?? (!children && typeof tooltip === 'string' ? tooltip : undefined)}
      >
        {iconPlacement === 'left' && iconComponent}
        {children && <span className={styles.content}>{children}</span>}
        {iconPlacement === 'right' && iconComponent}
      </a>
    );

    if (tooltip) {
      return (
        <Tooltip ref={ref} content={tooltip} placement={tooltipPlacement}>
          {button}
        </Tooltip>
      );
    }

    return button;
  }
);

LinkButton.displayName = 'LinkButton';

type IconElementProps = {
  className?: string;
  size?: IconSize;
};

interface IconRendererProps {
  icon?: IconName | React.ReactElement<IconElementProps>;
  size?: IconSize;
  className?: string;
  iconType?: IconType;
}
export const IconRenderer = ({ icon, size, className, iconType }: IconRendererProps) => {
  if (!icon) {
    return null;
  }
  if (React.isValidElement(icon)) {
    return React.cloneElement(icon, {
      className,
      size,
    });
  }
  return <Icon name={icon} size={size} className={className} type={iconType} />;
};

export interface StyleProps {
  size: ComponentSize;
  variant: ButtonVariant;
  fill?: ButtonFill;
  iconOnly?: boolean;
  theme: GrafanaTheme2;
  fullWidth?: boolean;
  narrow?: boolean;
}

export const getButtonStyles = (props: StyleProps) => {
  const { theme, variant, fill = 'solid', size, iconOnly, fullWidth } = props;
  const { height, padding, fontSize } = getPropertiesForButtonSize(size, theme);
  const variantStyles = getPropertiesForVariant(theme, variant, fill);
  const disabledStyles = getPropertiesForDisabled(theme, variant, fill);
  const focusStyle = getButtonFocusStyles(theme);
  const paddingMinusBorder = theme.spacing.gridSize * padding - 1;

  return {
    button: css({
      label: 'button',
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      fontSize: fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      fontFamily: theme.typography.fontFamily,
      padding: `0 ${paddingMinusBorder}px`,
      height: theme.spacing(height),
      // Deduct border from line-height for perfect vertical centering on windows and linux
      lineHeight: `${theme.spacing.gridSize * height - 2}px`,
      verticalAlign: 'middle',
      cursor: 'pointer',
      borderRadius: theme.shape.radius.default,
      '&:focus': focusStyle,
      '&:focus-visible': focusStyle,
      '&:focus:not(:focus-visible)': getMouseFocusStyles(theme),
      ...(fullWidth && {
        flexGrow: 1,
        justifyContent: 'center',
      }),
      ...variantStyles,
      ':disabled': disabledStyles,
      '&[disabled]': disabledStyles,

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color', 'border-color', 'color'], {
          duration: theme.transitions.duration.short,
        }),
      },
    }),
    disabled: css(disabledStyles, {
      '&:hover': css(disabledStyles),
      '&:focus': css(disabledStyles),
      '&:focus-visible': css(disabledStyles),
    }),
    img: css({
      width: '16px',
      height: '16px',
      margin: theme.spacing(0, 1, 0, 0.5),
    }),
    icon: iconOnly
      ? css({
          // Important not to set margin bottom here as it would override internal icon bottom margin
          marginRight: theme.spacing(-padding / 2),
          marginLeft: theme.spacing(-padding / 2),
        })
      : undefined,
    content: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      height: '100%',
    }),
  };
};

export function getActiveButtonStyles(color: ThemeRichColor, fill: ButtonFill, visualRefreshEnabled?: boolean) {
  let backgroundColor = 'transparent';
  if (fill === 'solid') {
    backgroundColor = color.main;

    if (visualRefreshEnabled) {
      backgroundColor = color.name === 'primary' ? color.mainEmphasis : color.backgroundEmphasis;
    }
  }
  return {
    background: backgroundColor,
  };
}

// These colors' background/border tokens are repointed to a saturated solid for their Button/Alert
// use, so outline and text fills can't use `color.background` for a subtle hover tint like other
// colors do - it would just match the solid fill. They fall back to the alpha-blended `transparent`.
const SEMANTIC_SOLID_COLOR_NAMES = ['error', 'success', 'warning', 'info'];

// Accent and secondary have no semantic alert counterpart, but their outline fill should still join
// the outlineMatchesAlertStyle experiment below - their background/border tokens were never repointed
// to a solid, so subtleBackground/subtleBorder already fall back to the same dark, two-tone look.
const OUTLINE_MATCHES_ALERT_STYLE_COLOR_NAMES = [...SEMANTIC_SOLID_COLOR_NAMES, 'accent', 'secondary'];

// Hover should always read as darker than the resting state, in both light and dark mode. The
// theme's backgroundEmphasis/borderEmphasis tokens don't guarantee that direction consistently
// across modes (they're mirrored per-mode, not defined relative to our repointed solid colors), so
// we compute it instead of looking up a token.
const HOVER_DARKEN_COEFFICIENT = 0.15;
// A gentler darken for the already-subtle outlineMatchesAlertStyle look - the full coefficient above,
// applied to a near-white/near-black subtle shade, darkens past the point of looking like a mere
// hover state and can end up reading as darker than an actual solid button (e.g. secondary's fill).
const SUBTLE_HOVER_DARKEN_COEFFICIENT = 0.06;
const darkenForHover = (color: string, coefficient = HOVER_DARKEN_COEFFICIENT) =>
  colorManipulator.darken(color, coefficient);

function getButtonVariantStyles(theme: GrafanaTheme2, color: ThemeRichColor, fill: ButtonFill) {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  const isSemanticSolidColor = SEMANTIC_SOLID_COLOR_NAMES.includes(color.name);
  // Design experiment: outline buttons take on the alert's subtle background+border instead of a
  // transparent background with a solid-color border. See `theme.flags.outlineMatchesAlertStyle`.
  const outlineMatchesAlertStyle = Boolean(
    visualRefreshEnabled &&
      theme.flags.outlineMatchesAlertStyle &&
      OUTLINE_MATCHES_ALERT_STYLE_COLOR_NAMES.includes(color.name)
  );

  let outlineBorderColor = color.border;
  let borderColor = visualRefreshEnabled ? color.border : 'transparent';
  let hoverBorderColor = 'transparent';
  const subtleHoverBackground = visualRefreshEnabled && isSemanticSolidColor ? color.transparent : color.background;

  // Secondary button has some special rules as we lack the color token to
  // specify border color for normal button vs border color for outline button
  if (color.name === 'secondary') {
    borderColor = color.border;
    hoverBorderColor = color.borderEmphasis;
    outlineBorderColor = theme.colors.border.strong;
  }

  if (fill === 'outline') {
    const restBorderColor = outlineMatchesAlertStyle ? color.subtleBorder : outlineBorderColor;
    // Darken background and border independently from their own resting shade (rather than
    // collapsing to one shared, much-darker value) so hover stays a subtle step up, not a jump
    // into territory as dark as an actual solid button's fill.
    const outlineMatchesAlertStyleHoverBackground = outlineMatchesAlertStyle
      ? darkenForHover(color.subtleBackground, SUBTLE_HOVER_DARKEN_COEFFICIENT)
      : undefined;
    const outlineMatchesAlertStyleHoverBorder = outlineMatchesAlertStyle
      ? darkenForHover(color.subtleBorder, SUBTLE_HOVER_DARKEN_COEFFICIENT)
      : undefined;

    return {
      background: outlineMatchesAlertStyle ? color.subtleBackground : 'transparent',
      color: color.text,
      border: `1px solid ${restBorderColor}`,

      '&:hover, &:focus': {
        background: outlineMatchesAlertStyleHoverBackground
          ? outlineMatchesAlertStyleHoverBackground
          : visualRefreshEnabled
            ? subtleHoverBackground
            : color.transparent,
        borderColor: outlineMatchesAlertStyleHoverBorder
          ? outlineMatchesAlertStyleHoverBorder
          : visualRefreshEnabled
            ? outlineBorderColor
            : theme.colors.emphasize(outlineBorderColor, 0.25),
        color: visualRefreshEnabled ? color.textEmphasis : color.text,
      },

      '&:active': {
        ...getActiveButtonStyles(color, fill, visualRefreshEnabled),
      },
    };
  }

  if (fill === 'text') {
    return {
      background: 'transparent',
      color: color.text,
      border: '1px solid transparent',

      '&:hover, &:focus': {
        background: visualRefreshEnabled ? subtleHoverBackground : color.transparent,
        color: visualRefreshEnabled ? color.textEmphasis : color.text,
        textDecoration: 'none',
        outline: 'none',
      },

      '&:active': {
        ...getActiveButtonStyles(color, fill, visualRefreshEnabled),
      },
    };
  }

  let backgroundColor = color.main;
  let hoverBackgroundColor = color.shade;
  let textColor = color.contrastText;
  let hoverTextColor = color.contrastText;

  if (visualRefreshEnabled) {
    textColor = color.text;
    hoverTextColor = color.textEmphasis;
    backgroundColor = color.background;
    hoverBackgroundColor = color.backgroundEmphasis;

    // Primary is a brand color used broadly beyond buttons (menus, badges, focus rings, etc.),
    // so its solid fill uses main/contrastText directly instead of the shared background/border/text
    // tokens the other semantic colors below repoint for their solid fill.
    if (color.name === 'primary' && fill === 'solid') {
      backgroundColor = color.main;
      hoverBackgroundColor = color.mainEmphasis;
      borderColor = 'transparent';
      hoverBorderColor = 'transparent';
      textColor = color.contrastText;
      hoverTextColor = color.contrastText;
    }

    // Accent is also used broadly beyond buttons, so rather than repoint its shared background/border
    // tokens, we borrow its existing border/backgroundEmphasis/textEmphasis values (already a darker
    // solid orange, with a lighter tint for contrast) to give its solid fill the same look as the
    // semantic colors below, scoped to just this button.
    if (color.name === 'accent' && fill === 'solid') {
      backgroundColor = color.border;
      hoverBackgroundColor = darkenForHover(backgroundColor);
      textColor = color.textEmphasis;
      hoverTextColor = color.textEmphasis;
    }

    // Secondary's solid fill shouldn't show a border either, matching primary/accent above.
    // Its backgroundEmphasis token is lighter than background in dark mode, so darken instead.
    if (color.name === 'secondary' && fill === 'solid') {
      borderColor = 'transparent';
      hoverBorderColor = 'transparent';
      hoverBackgroundColor = darkenForHover(backgroundColor);
    }

    // Semantic colors' solid fill has a saturated background, so it needs a stronger-contrast
    // shade than the base text color used elsewhere. In dark mode that's the lighter textEmphasis
    // (*200); in light mode, color.text (*700, e.g. red700 #812f2d) reads better against the *100
    // background than textEmphasis (*800) while still giving comfortable contrast (5.9:1+).
    if (fill === 'solid' && SEMANTIC_SOLID_COLOR_NAMES.includes(color.name)) {
      textColor = theme.colors.mode === 'light' ? color.text : color.textEmphasis;
      hoverTextColor = textColor;
      hoverBackgroundColor = darkenForHover(backgroundColor);
    }
  }

  return {
    background: backgroundColor,
    color: textColor,
    border: `1px solid ${borderColor}`,

    '&:hover': {
      background: hoverBackgroundColor,
      color: hoverTextColor,
      boxShadow: theme.shadows.z1,
      borderColor: hoverBorderColor,
    },

    '&:focus': {
      background: hoverBackgroundColor,
      color: hoverTextColor,
      borderColor: hoverBorderColor,
    },

    '&:active': {
      ...getActiveButtonStyles(color, fill, visualRefreshEnabled),
    },
  };
}

function getPropertiesForDisabled(theme: GrafanaTheme2, variant: ButtonVariant, fill: ButtonFill) {
  const disabledStyles = {
    cursor: 'not-allowed',
    boxShadow: 'none',
    color: theme.colors.text.disabled,
    transition: 'none',
    background: theme.colors.action.disabledBackground,
  };

  if (fill === 'text') {
    return {
      ...disabledStyles,
      background: 'transparent',
      border: `1px solid transparent`,
    };
  }

  if (fill === 'outline') {
    return {
      ...disabledStyles,
      background: 'transparent',
      border: `1px solid ${theme.colors.border.weak}`,
    };
  }

  return {
    ...disabledStyles,
    background: theme.colors.action.disabledBackground,
    border: `1px solid transparent`,
  };
}

export function getPropertiesForVariant(theme: GrafanaTheme2, variant: ButtonVariant, fill: ButtonFill) {
  switch (variant) {
    case 'secondary':
      // The seconday button has some special handling as it's outline border is it's default color border
      return getButtonVariantStyles(theme, theme.colors.secondary, fill);

    case 'destructive':
      return getButtonVariantStyles(theme, theme.colors.error, fill);

    case 'success':
      return getButtonVariantStyles(theme, theme.colors.success, fill);

    case 'accent':
      return getButtonVariantStyles(theme, theme.colors.accent, fill);

    case 'primary':
    default:
      return getButtonVariantStyles(theme, theme.colors.primary, fill);
  }
}

export const clearButtonStyles = (theme: GrafanaTheme2) => {
  return css({
    background: 'transparent',
    color: theme.colors.text.primary,
    border: 'none',
    padding: 0,
  });
};
