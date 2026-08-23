import { css, cx } from '@emotion/css';
import { type AriaRole, type HTMLAttributes, type ReactNode } from 'react';
import * as React from 'react';

import { type ThemeTypographyVariantTypes, type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useTheme2 } from '../../themes/ThemeContext';
import { type IconName, type IconSize } from '../../types/icon';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';
export type AlertVariant = 'success' | 'warning' | 'error' | 'info' | 'tertiary' | 'accent';

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
  size?: 'sm' | 'md' | 'lg';
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
      size = 'md',
      ...restProps
    },
    ref
  ) => {
    const theme = useTheme2();
    const hasTitle = Boolean(title);
    const styles = getStyles(theme, severity, hasTitle, elevated, bottomSpacing, topSpacing, size);
    const rolesBySeverity: Record<AlertVariant, AriaRole> = {
      error: 'alert',
      warning: 'alert',
      info: 'status',
      success: 'status',
      tertiary: 'status',
      accent: 'status',
    };
    const role = restProps['role'] || rolesBySeverity[severity];
    const ariaLabel = restProps['aria-label'] || title;

    const closeLabel = t('grafana-ui.alert.close-button', 'Close alert');

    return (
      <div ref={ref} className={cx(styles.wrapper, className)} role={role} aria-label={ariaLabel} {...restProps}>
        <div data-testid={selectors.components.Alert.alertV2(severity)} className={styles.box}>
          <Box display="flex" alignItems="flex-start" justifyContent="flex-start">
            <div className={styles.icon}>
              <Icon size={styles.iconSize} name={getIconFromSeverity(severity)} />
            </div>
          </Box>

          <Stack alignItems="center" flex={1} wrap="wrap" columnGap={1} rowGap={0}>
            <Box flex={1} minWidth="50%">
              <Text color={severity} variant={styles.titleVariant} weight="medium">
                {title}
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
    case 'tertiary':
      return 'info-circle';
    case 'accent':
      return 'info-circle';
  }
};

function getSpacing(size: 'sm' | 'md' | 'lg'): {
  padding: number;
  iconWidth: number;
  iconSize: IconSize;
  titleVariant: keyof ThemeTypographyVariantTypes;
} {
  switch (size) {
    case 'sm':
      return { padding: 1, iconWidth: 4, iconSize: 'md', titleVariant: 'h6' };
    case 'md':
      return { padding: 2, iconWidth: 5, iconSize: 'xl', titleVariant: 'h5' };
    case 'lg':
      return { padding: 3, iconWidth: 7, iconSize: 'xxl', titleVariant: 'h4' };
  }
}

const getStyles = (
  theme: GrafanaTheme2,
  severity: AlertVariant,
  hasTitle: boolean,
  elevated?: boolean,
  bottomSpacing?: number,
  topSpacing?: number,
  size: 'sm' | 'md' | 'lg' = 'md'
) => {
  const color = theme.colors[severity];
  const sizing = getSpacing(size);

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
    titleVariant: sizing.titleVariant,
    box: css({
      display: 'flex',
      borderRadius: theme.shape.radius.lg,
      boxShadow: elevated ? theme.shadows.z3 : undefined,
      padding: theme.spacing(sizing.padding),
      //background: `linear-gradient(345deg, ${theme.components.card.background} 20%, color-mix(in oklab, ${theme.components.card.background} 41%, ${color.background}))`,
      background: `color-mix(in oklab, ${theme.components.card.background} 60%, ${color.background})`,
      border: `1px solid color-mix(in oklab, ${theme.colors.background.page} 55%, ${color.border})`,
      gap: theme.spacing(sizing.padding),
    }),
    icon: css({
      color: color.text,
      backgroundColor: `color-mix(in oklab, ${theme.components.card.background} 40%, ${color.backgroundEmphasis})`,
      position: 'relative',
      width: theme.spacing(sizing.iconWidth),
      height: theme.spacing(sizing.iconWidth),
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    iconSize: sizing.iconSize,
    content: css({
      color: theme.colors.text.primary,
      maxHeight: '50vh',
      overflowY: 'auto',
    }),
    close: css({
      position: 'relative',
      color: theme.colors.text.secondary,
      background: 'none',
      display: 'flex',
    }),
  };
};
