import { css, cx } from '@emotion/css';
import { type AriaRole, type HTMLAttributes, type ReactNode } from 'react';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useTheme2 } from '../../themes/ThemeContext';
import { type IconName } from '../../types/icon';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';
export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  title: string;
  /** On click handler for alert button, mostly used for dismissing the alert */
  onRemove?: (event: React.MouseEvent) => void;
  severity?: AlertVariant;
  children?: ReactNode;
  elevated?: boolean;
  buttonContent?: React.ReactNode | string;
  bottomSpacing?: number;
  topSpacing?: number;
  /** Custom action element rendered in the alert's button area, independently from the dismiss button. */
  action?: ReactNode;
}

/**
 * An alert displays an important message in a way that attracts the user's attention without interrupting the user's task.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/information-alert--docs
 */
export const Alert = React.forwardRef<HTMLDivElement, Props>(
  (
    {
      title,
      onRemove,
      children,
      buttonContent,
      elevated,
      bottomSpacing,
      topSpacing,
      className,
      severity = 'error',
      action,
      ...restProps
    },
    ref
  ) => {
    const theme = useTheme2();
    const hasTitle = Boolean(title);
    const styles = getStyles(theme, severity, hasTitle, elevated, bottomSpacing, topSpacing);
    const rolesBySeverity: Record<AlertVariant, AriaRole> = {
      error: 'alert',
      warning: 'alert',
      info: 'status',
      success: 'status',
    };
    const role = restProps['role'] || rolesBySeverity[severity];
    const ariaLabel = restProps['aria-label'] || title;

    const closeLabel = t('grafana-ui.alert.close-button', 'Close alert');

    return (
      <div ref={ref} className={cx(styles.wrapper, className)} role={role} aria-label={ariaLabel} {...restProps}>
        <div data-testid={selectors.components.Alert.alertV2(severity)} className={styles.surface}>
          <Box paddingRight={2}>
            <div className={styles.iconBox}>
              <Icon size="lg" name={getIconFromSeverity(severity)} className={styles.icon} />
            </div>
          </Box>

          <Stack alignItems="center" flex={1} wrap="wrap" columnGap={1} rowGap={0}>
            <Box paddingY={1} flex={1} minWidth="50%">
              <Text weight="medium">
                <span className={styles.title}>{title}</span>
              </Text>
              {children && <div className={styles.content}>{children}</div>}
            </Box>
            <Stack alignItems="center" wrap="wrap">
              {action}
              {onRemove && buttonContent && (
                <Button aria-label={closeLabel} variant="secondary" onClick={onRemove} type="button">
                  {buttonContent}
                </Button>
              )}
            </Stack>
          </Stack>
          {/* If onRemove is specified, giving preference to onRemove */}
          {onRemove && !buttonContent && (
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

Alert.displayName = 'Alert';

const getIconFromSeverity = (severity: AlertVariant): IconName => {
  switch (severity) {
    case 'error':
      return 'exclamation-circle';
    case 'warning':
      return 'exclamation-triangle';
    case 'info':
      return 'info-circle';
    case 'success':
      return 'check';
  }
};

const getStyles = (
  theme: GrafanaTheme2,
  severity: AlertVariant,
  hasTitle: boolean,
  elevated?: boolean,
  bottomSpacing?: number,
  topSpacing?: number
) => {
  const color = theme.colors[severity];
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  const surfaceBackground = visualRefreshEnabled ? color.subtleBackground : color.transparent;
  const surfaceBorder = visualRefreshEnabled ? color.subtleBorder : color.borderTransparent;
  // In light mode, color.text is claimed by the matching solid button (a different shade), so the
  // alert's icon and text (title + body) use mainEmphasis instead - in dark mode, color.text is
  // free and matches what the alert needs directly. Legacy (non-refresh) theme is untouched.
  const isLight = theme.colors.mode === 'light';
  const iconColor = visualRefreshEnabled ? (isLight ? color.mainEmphasis : color.main) : color.text;
  const textColor = visualRefreshEnabled ? (isLight ? color.mainEmphasis : color.text) : theme.colors.text.primary;

  return {
    wrapper: css({
      flexGrow: 1,
      marginBottom: theme.spacing(bottomSpacing ?? 2),
      marginTop: theme.spacing(topSpacing ?? 0),
      position: 'relative',

      '&:before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        background: theme.colors.background.primary,
        borderRadius: theme.shape.radius.lg,
        zIndex: -1,
      },
    }),
    surface: css({
      display: 'flex',
      alignItems: 'center',
      borderRadius: theme.shape.radius.lg,
      padding: theme.spacing(1, 2),
      border: `1px solid ${surfaceBorder}`,
      backgroundColor: surfaceBackground,
      boxShadow: elevated ? theme.shadows.z3 : undefined,
    }),
    iconBox: css({
      display: 'inline-flex',
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      backgroundColor: color.backgroundEmphasis,
    }),
    icon: css({
      color: iconColor,
    }),
    title: css({
      color: textColor,
    }),
    content: css({
      color: textColor,
      paddingTop: hasTitle ? theme.spacing(0.5) : 0,
      maxHeight: '50vh',
      overflowY: 'auto',
    }),
    close: css({
      position: 'relative',
      color: theme.colors.text.secondary,
      background: 'none',
      display: 'flex',
      top: '-6px',
      right: '-14px',
    }),
  };
};
