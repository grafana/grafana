import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes/ThemeContext';

import { AbstractBanner, type AbstractBannerProps } from './AbstractBanner';
import { type BannerCustomColors, type BannerThemeColor, getBannerColors } from './Banner.styles';
import { type BannerSeverity } from './types';
import { getIconFromSeverity, recolorContentButtons, restyleAction, rolesBySeverity } from './utils';

export type { BannerThemeColor } from './Banner.styles';

/** A severity, for a status message, or `neutral`, for any other message, such as a feature announcement. */
export type BannerVariant = BannerSeverity | 'neutral';

// Banner sets these from its variant, theme color or custom colors.
type DerivedProps =
  | 'backgroundColor'
  | 'borderColor'
  | 'iconColor'
  | 'textColor'
  | 'emphasisColor'
  | 'dismissIconColor'
  | 'dismissButtonBackgroundColor'
  | 'dismissButtonTextColor'
  | 'dataTestId';

type NoCustomColors = { [K in keyof BannerCustomColors]?: never };

type SeverityProps = NoCustomColors & {
  /**
   * The kind of message. A severity sets the banner's colors and icon, and makes it a live region that screen readers
   * announce: `alert` for `error` and `warning`, `status` for `info` and `success`. `neutral`, the default, is for a
   * message without a severity, such as a feature announcement: a section landmark named by its title, which isn't
   * announced.
   */
  variant: BannerSeverity;
  /**
   * Shows the banner on a saturated background, for the single most important message on a page, such as an overdue
   * invoice. Show at most one prominent banner on a page, at the top. Only for a severity.
   */
  isProminent?: boolean;
  themeColor?: never;
};

type NeutralThemeColorProps = NoCustomColors & {
  variant?: 'neutral';
  isProminent?: never;
  /** The theme color of a neutral banner. Defaults to `primary`. */
  themeColor?: BannerThemeColor;
};

type NeutralCustomColorProps = BannerCustomColors & {
  variant?: 'neutral';
  isProminent?: never;
  themeColor?: never;
};

export type BannerProps = Omit<AbstractBannerProps, DerivedProps> &
  (SeverityProps | NeutralThemeColorProps | NeutralCustomColorProps);

/**
 * A banner displays a message with a title, optional content, an optional action and an optional dismiss control.
 * `variant` sets what kind of message it is: a severity for a status message, or `neutral` (the default) for any other
 * message. A neutral banner takes a `themeColor`, or, as an escape hatch, all four custom colors.
 *
 * A Button or LinkButton in `action`, at any depth, is rendered as a BannerActionButton in the banner's colors. A
 * BannerActionButton in the content is given the banner's colors too.
 */
export const Banner = React.forwardRef<HTMLDivElement, BannerProps>(
  (
    {
      variant = 'neutral',
      isProminent,
      themeColor,
      backgroundColor,
      borderColor,
      iconColor,
      textColor,
      role,
      icon,
      action,
      children,
      ...restProps
    },
    ref
  ) => {
    const theme = useTheme2();
    const severity = variant === 'neutral' ? undefined : variant;
    const customColors =
      backgroundColor !== undefined && borderColor !== undefined && iconColor !== undefined && textColor !== undefined
        ? { backgroundColor, borderColor, iconColor, textColor }
        : undefined;
    const { actionColor, ...colors } = getBannerColors(
      theme,
      severity ? { severity, isProminent } : { themeColor, customColors }
    );

    return (
      <AbstractBanner
        ref={ref}
        role={role ?? (severity ? rolesBySeverity[severity] : undefined)}
        icon={icon ?? (severity ? getIconFromSeverity(severity) : undefined)}
        dataTestId={severity ? selectors.components.Alert.alertV2(severity) : selectors.components.Banner.container}
        // A severity's outline colors don't contrast with the saturated background of the same severity, so a
        // prominent banner replaces an action button's own colors.
        action={restyleAction(action, actionColor, Boolean(severity && isProminent))}
        {...colors}
        {...restProps}
      >
        {recolorContentButtons(children, actionColor)}
      </AbstractBanner>
    );
  }
);

Banner.displayName = 'Banner';
