import { type HTMLAttributes, type ReactNode } from 'react';
import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes/ThemeContext';
import { Banner } from '../Banner/Banner';

import { getIconFromSeverity, getSeverityAction, rolesBySeverity } from './utils';

// TODO: move to a status type shared with Button's ButtonVariant, where 'danger' replaces 'error' here and
// 'destructive' there.
export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  title: string;
  /** On click handler for alert button, mostly used for dismissing the alert */
  onRemove?: (event: React.MouseEvent) => void;
  /** Sets the alert's colors, icon and role. Defaults to `error`. */
  severity?: AlertVariant;
  children?: ReactNode;
  elevated?: boolean;
  /** Reduces the alert's padding to 4px top and bottom and 12px left and right, for a shorter alert. */
  isCompact?: boolean;
  /**
   * Content of the dismiss button, which replaces the X icon and needs `onRemove`. It is rendered inside the
   * banner's dismiss button.
   */
  buttonContent?: React.ReactNode | string;
  bottomSpacing?: number;
  topSpacing?: number;
  /**
   * Custom action element rendered in the alert's button area, independently from the dismiss button.
   * The buttons in it are restyled to match the alert, at any depth: a `Button` or `LinkButton` is rendered as a
   * BannerActionButton in the outline colors of the severity. Their `variant`, `fill`, `size`, `fullWidth` and
   * `className` are ignored, and their other props, such as `onClick`, `href`, `icon`, `tooltip`, `disabled` and `ref`,
   * are kept. A BannerActionButton without a `severity` or `customColor` gets the alert's severity. Any other element,
   * including a component that renders a `Button` itself, is rendered as passed.
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
        action={getSeverityAction(action, severity)}
        {...restProps}
      />
    );
  }
);

Alert.displayName = 'Alert';
