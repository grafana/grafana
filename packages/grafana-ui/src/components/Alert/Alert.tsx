import { type HTMLAttributes, type ReactNode } from 'react';
import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes/ThemeContext';
import { Banner } from '../Banner/Banner';

import { buttonVariantsBySeverity, getIconFromSeverity, getOutlineAction, rolesBySeverity } from './utils';

// TODO: move to a status type shared with Button's ButtonVariant, where 'danger' replaces 'error' here and 'destructive' there.
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
  /**
   * Custom action element rendered in the alert's button area, independently from the dismiss button.
   * A `Button` passed here is rendered with `fill="outline"`. Its variant matches the severity in `Alert`,
   * and is `primary` in `AlertBanner`.
   */
  action?: ReactNode;
}

/**
 * An alert displays an important message in a way that attracts the user's attention without interrupting the user's task.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/information-alert--docs
 */
export const Alert = React.forwardRef<HTMLDivElement, Props>(
  ({ severity = 'error', role, action, ...restProps }, ref) => {
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
        action={getOutlineAction(action, buttonVariantsBySeverity[severity])}
        {...restProps}
      />
    );
  }
);

Alert.displayName = 'Alert';
