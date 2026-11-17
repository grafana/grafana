import { cx } from '@emotion/css';
import { type AriaRole, type HTMLAttributes, type ReactNode } from 'react';
import * as React from 'react';

import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { type IconName } from '../../types/icon';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { Spinner } from '../Spinner/Spinner';
import { Text } from '../Text/Text';

import { getStyles } from './Banner.styles';

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  /** The banner's heading. Also its accessible name unless `aria-label` is set. */
  title: string;
  /** The ARIA role of the banner. Use `alert` for urgent messages and `status` for advisory ones. */
  role: AriaRole;
  /** The icon shown beside the title. */
  icon: IconName;
  /** Replaces the icon with a spinner of the same size and color, and hides the dismiss X icon. */
  isLoading?: boolean;
  /** Fill color of the banner. */
  backgroundColor: string;
  /** Color of the banner's 1px edge. */
  borderColor: string;
  /** Color of the icon. */
  iconColor: string;
  /** Color of the title and supporting text. */
  textColor: string;
  /** Fill of the icon tile and the dismiss button's hover state. Defaults to the background mixed with 6% of the icon color. */
  emphasisColor?: string;
  /** Color of the dismiss X icon. Defaults to the secondary button color. */
  dismissIconColor?: string;
  /** Test id applied to the banner's inner container. A `data-testid` passed as an HTML attribute goes on the outer element. */
  dataTestId?: string;
  /** Click handler for the dismiss button. Renders an X icon button, or a text button when `buttonContent` is set. */
  onRemove?: (event: React.MouseEvent) => void;
  /** Supporting detail shown beneath the title. */
  children?: ReactNode;
  /** Lifts the banner onto a floating surface with a shadow, for example when it is used as a toast. */
  elevated?: boolean;
  /**
   * Replaces the X icon with a text dismiss button. A `Button` is rendered as passed, with its own click handler.
   * Anything else is wrapped in a secondary `Button` that calls `onRemove`, and requires `onRemove`.
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
      backgroundColor,
      borderColor,
      iconColor,
      textColor,
      emphasisColor,
      dismissIconColor,
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
    const styles = useStyles2(
      getStyles,
      backgroundColor,
      borderColor,
      iconColor,
      textColor,
      emphasisColor,
      dismissIconColor,
      elevated,
      bottomSpacing,
      topSpacing
    );
    const ariaLabel = restProps['aria-label'] || title;

    const closeLabel = t('grafana-ui.alert.close-button', 'Close alert');
    const isButtonElement = React.isValidElement(buttonContent) && buttonContent.type === Button;

    return (
      <div ref={ref} className={cx(styles.wrapper, className)} role={role} aria-label={ariaLabel} {...restProps}>
        <div className={styles.container} data-testid={dataTestId}>
          <Box display="flex" paddingY={0.5} paddingRight={2}>
            <div className={styles.iconBox}>
              {isLoading ? (
                <Spinner inline size={iconSize} iconClassName={styles.icon} />
              ) : (
                <Icon size={iconSize} name={icon} className={styles.icon} />
              )}
            </div>
          </Box>

          <Stack alignItems="center" flex={1} wrap="wrap" columnGap={1} rowGap={0}>
            <Box flex={1} minWidth="50%">
              <Text weight="medium">
                <span className={styles.title}>{title}</span>
              </Text>
              {children && <div className={styles.content}>{children}</div>}
            </Box>
            <Stack alignItems="center" wrap="wrap">
              {action}
              {isButtonElement
                ? buttonContent
                : onRemove &&
                  buttonContent && (
                    <Button variant="secondary" onClick={onRemove} type="button">
                      {buttonContent}
                    </Button>
                  )}
            </Stack>
          </Stack>
          {/* If onRemove is specified, giving preference to onRemove */}
          {onRemove && !buttonContent && !isLoading && (
            <div className={styles.close}>
              <Button
                aria-label={closeLabel}
                icon="times"
                onClick={onRemove}
                type="button"
                fill="text"
                variant="secondary"
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);

Banner.displayName = 'Banner';
