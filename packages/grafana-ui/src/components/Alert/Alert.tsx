import { css, cx } from '@emotion/css';
import { AriaRole, HTMLAttributes, ReactNode } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes';
import { IconName } from '../../types/icon';
import { t } from '../../utils/i18n';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Box } from '../Layout/Box/Box';
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
}

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
        <Box
          data-testid={selectors.components.Alert.alertV2(severity)}
          display="flex"
          backgroundColor={severity}
          borderRadius="default"
          paddingY={1}
          paddingX={2}
          borderStyle="solid"
          borderColor={severity}
          alignItems="stretch"
          boxShadow={elevated ? 'z3' : undefined}
        >
          <Box paddingTop={1} paddingRight={2}>
            <div className={styles.icon}>
              <Icon size="xl" name={getIconFromSeverity(severity)} />
            </div>
          </Box>

          <Box paddingY={1} grow={1}>
            <Text color="primary" weight="medium">
              {title}
            </Text>
            {children && <div className={styles.content}>{children}</div>}
          </Box>
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

          {onRemove && buttonContent && (
            <Box marginLeft={1} display="flex" alignItems="center">
              <Button aria-label={closeLabel} variant="secondary" onClick={onRemove} type="button">
                {buttonContent}
              </Button>
            </Box>
          )}
        </Box>
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export const getIconFromSeverity = (severity: AlertVariant): IconName => {
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
        zIndex: -1,
      },
    }),
    icon: css({
      color: color.text,
      position: 'relative',
      top: '-1px',
    }),
    content: css({
      color: theme.colors.text.primary,
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
