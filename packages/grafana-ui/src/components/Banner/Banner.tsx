import { cx } from '@emotion/css';
import { type AriaRole, type HTMLAttributes, type ReactNode, useId, useMemo } from 'react';
import * as React from 'react';

import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { type IconName } from '../../types/icon';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { Spinner } from '../Spinner/Spinner';
import { Text } from '../Text/Text';

import { getOpaqueBackgroundColor, getStyles } from './Banner.styles';
import { BannerDismissButton } from './BannerDismissButton';

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  /** The banner's heading. Also its accessible name unless `aria-label` is set. */
  title: string;
  /**
   * The ARIA role of the banner. `alert` and `status` are live regions, which screen readers announce when the banner
   * appears: use `alert` for urgent messages and `status` for advisory ones. Without a role, the banner is a section
   * landmark named by its title, and isn't announced, which suits a promotional banner.
   */
  role?: AriaRole;
  /** The icon shown beside the title. Without an icon, and when not loading, the banner shows no icon tile. */
  icon?: IconName;
  /**
   * Replaces the icon with a spinner of the same size and color, and hides the dismiss control: the X icon or the
   * buttonContent button.
   */
  isLoading?: boolean;
  /** Reduces the banner's padding to 4px top and bottom and 12px left and right, for a shorter banner. */
  isCompact?: boolean;
  /** Fill color of the banner. */
  backgroundColor: string;
  /** Color of the banner's 1px edge. */
  borderColor: string;
  /** Color of the icon. */
  iconColor: string;
  /** Color of the title and supporting text. */
  textColor: string;
  /**
   * Fill of the icon tile and of the dismiss X's hover state. Defaults to the background mixed with 6% of the icon
   * color.
   */
  emphasisColor?: string;
  /** Color of the dismiss X icon. Defaults to the secondary IconButton color. */
  dismissIconColor?: string;
  /** Fill of the text dismiss button that wraps `buttonContent`. Defaults to `iconColor`. */
  dismissButtonBackgroundColor?: string;
  /**
   * Text color of the text dismiss button that wraps `buttonContent`. Defaults to `backgroundColor` in the refresh
   * themes, and to an opaque version of it in the others, whose banner backgrounds are translucent.
   */
  dismissButtonTextColor?: string;
  /**
   * Test id applied to the banner's inner container. A `data-testid` passed as an HTML attribute goes on the outer
   * element.
   */
  dataTestId?: string;
  /** Click handler for the dismiss button. Renders an X icon button, or a text button when `buttonContent` is set. */
  onRemove?: (event: React.MouseEvent) => void;
  /** Supporting detail shown beneath the title. */
  children?: ReactNode;
  /** Lifts the banner onto a floating surface with a shadow, for example when it is used as a toast. */
  elevated?: boolean;
  /**
   * Replaces the X icon with a text dismiss button, and requires `onRemove`. The content is wrapped in a
   * `BannerDismissButton` that calls `onRemove`, colored with `dismissButtonBackgroundColor` and
   * `dismissButtonTextColor`.
   */
  buttonContent?: React.ReactNode | string;
  /** Space below the banner, in theme spacing units. Defaults to 2. */
  bottomSpacing?: number;
  /** Space above the banner, in theme spacing units. Defaults to 0. */
  topSpacing?: number;
  /** Custom action element rendered in the banner's button area, independently from the dismiss button. */
  action?: ReactNode;
}

/**
 * A banner displays a message in a prominent, full-width way.
 */
export const Banner = React.forwardRef<HTMLDivElement, BannerProps>(
  (
    {
      title,
      role,
      icon,
      isLoading,
      isCompact,
      backgroundColor,
      borderColor,
      iconColor,
      textColor,
      emphasisColor,
      dismissIconColor,
      dismissButtonBackgroundColor,
      dismissButtonTextColor,
      dataTestId,
      onRemove,
      children,
      buttonContent,
      elevated,
      bottomSpacing,
      topSpacing,
      className,
      action,
      ...restProps
    },
    ref
  ) => {
    const theme = useTheme2();
    const visualRefreshEnabled = theme.flags.visualDesignRefresh;
    const iconSize = visualRefreshEnabled ? 'lg' : 'xl';
    const showDismissButton = Boolean(onRemove) && Boolean(buttonContent) && !isLoading;
    const showDismissIcon = Boolean(onRemove) && !buttonContent && !isLoading;
    // useStyles2 caches getStyles by the identity of its arguments, so the options object only changes when a value
    // does.
    const styleOptions = useMemo(
      () => ({
        backgroundColor,
        borderColor,
        iconColor,
        textColor,
        emphasisColor,
        dismissIconColor,
        elevated,
        bottomSpacing,
        topSpacing,
        hasDismissIcon: showDismissIcon,
        isCompact,
      }),
      [
        backgroundColor,
        borderColor,
        iconColor,
        textColor,
        emphasisColor,
        dismissIconColor,
        elevated,
        bottomSpacing,
        topSpacing,
        showDismissIcon,
        isCompact,
      ]
    );
    const styles = useStyles2(getStyles, styleOptions);
    const titleId = useId();
    const { 'aria-label': ariaLabelProp, ...wrapperProps } = restProps;
    // With a role, the banner is a live region named by its title. Without one, its container is a section landmark
    // named by the title, so that it is listed with the page's landmarks but not announced when it appears.
    const Container = role ? 'div' : 'section';
    const containerLabelProps = role
      ? {}
      : ariaLabelProp
        ? { 'aria-label': ariaLabelProp }
        : { 'aria-labelledby': titleId };

    const closeLabel = t('grafana-ui.alert.close-button', 'Close alert');

    return (
      <div
        ref={ref}
        className={cx(styles.wrapper, className)}
        role={role}
        aria-label={role ? ariaLabelProp || title : undefined}
        {...wrapperProps}
      >
        <Container className={styles.container} data-testid={dataTestId} {...containerLabelProps}>
          {(icon || isLoading) && (
            <Box display="flex" paddingY={0.5}>
              <div className={styles.iconBox}>
                {isLoading ? (
                  <Spinner inline size={iconSize} iconClassName={styles.icon} />
                ) : (
                  icon && <Icon size={iconSize} name={icon} className={styles.icon} />
                )}
              </div>
            </Box>
          )}

          <Stack alignItems="center" flex={1} wrap="wrap" columnGap={1} rowGap={0}>
            <Box flex={1} minWidth="50%">
              <Text weight="medium">
                <span id={titleId} className={styles.title}>
                  {title}
                </span>
              </Text>
              {children && <div className={styles.content}>{children}</div>}
            </Box>
            <Stack alignItems="center" wrap="wrap">
              {action}
              {showDismissButton && (
                <BannerDismissButton
                  backgroundColor={dismissButtonBackgroundColor ?? iconColor}
                  textColor={
                    dismissButtonTextColor ??
                    (visualRefreshEnabled ? backgroundColor : getOpaqueBackgroundColor(theme, backgroundColor))
                  }
                  onClick={onRemove}
                >
                  {buttonContent}
                </BannerDismissButton>
              )}
              {showDismissIcon && (
                <IconButton
                  className={styles.dismissButton}
                  aria-label={closeLabel}
                  name="times"
                  size="xl"
                  onClick={onRemove}
                />
              )}
            </Stack>
          </Stack>
        </Container>
      </div>
    );
  }
);

Banner.displayName = 'Banner';
