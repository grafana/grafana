import { type AriaRole, type HTMLAttributes, type ReactNode } from 'react';
import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes/ThemeContext';
import { type IconName } from '../../types/icon';
import { Banner } from '../Banner/Banner';

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
export const Alert = React.forwardRef<HTMLDivElement, Props>(({ severity = 'error', role, ...restProps }, ref) => {
  const theme = useTheme2();
  const color = theme.colors[severity];
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;

  return (
    <Banner
      ref={ref}
      role={role || rolesBySeverity[severity]}
      icon={getIconFromSeverity(severity)}
      backgroundColor={visualRefreshEnabled ? color.subtleBackground : color.transparent}
      borderColor={visualRefreshEnabled ? color.subtleBorder : color.borderTransparent}
      iconColor={color.text}
      textColor={visualRefreshEnabled ? color.textEmphasis : theme.colors.text.primary}
      dataTestId={selectors.components.Alert.alertV2(severity)}
      {...restProps}
    />
  );
});

Alert.displayName = 'Alert';

const rolesBySeverity: Record<AlertVariant, AriaRole> = {
  error: 'alert',
  warning: 'alert',
  info: 'status',
  success: 'status',
};

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
