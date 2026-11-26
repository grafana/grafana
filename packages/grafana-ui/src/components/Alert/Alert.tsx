import { type HTMLAttributes, type ReactNode } from 'react';
import * as React from 'react';

import { Banner } from '../Banner/Banner';
import { type BannerSeverity } from '../Banner/types';

export type AlertVariant = BannerSeverity;

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
 * @deprecated Use `Banner` instead: `<Banner variant={severity}>`. Alert renders a Banner with the same props, with
 * `severity` (default `error`) as `variant` and `elevated` as `isElevated`.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/information-banner--docs
 */
export const Alert = React.forwardRef<HTMLDivElement, Props>(({ severity = 'error', elevated, ...restProps }, ref) => (
  <Banner ref={ref} variant={severity} isElevated={elevated} {...restProps} />
));

Alert.displayName = 'Alert';
