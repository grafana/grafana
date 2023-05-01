import { css, cx } from '@emotion/css';
import React, { AriaRole, HTMLAttributes, ReactNode } from 'react';
import tinycolor2 from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes';
import { IconName } from '../../types/icon';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';

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

    return (
      <div
        ref={ref}
        className={cx(styles.alert, className)}
        data-testid={selectors.components.Alert.alertV2(severity)}
        role={role}
        aria-label={ariaLabel}
        {...restProps}
      >
        <div className={styles.icon}>
          <Icon size="xl" name={getIconFromSeverity(severity)} />
        </div>

        <div className={styles.body}>
          <div className={styles.title}>{title}</div>
          {children && <div className={styles.content}>{children}</div>}
        </div>

        {/* If onRemove is specified, giving preference to onRemove */}
        {onRemove && !buttonContent && (
          <div className={styles.close}>
            <Button
              aria-label="Close alert"
              icon="times"
              onClick={onRemove}
              type="button"
              fill="text"
              variant="secondary"
            />
          </div>
        )}

        {onRemove && buttonContent && (
          <div className={styles.buttonWrapper}>
            <Button aria-label="Close alert" variant="secondary" onClick={onRemove} type="button">
              {buttonContent}
            </Button>
          </div>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export const getIconFromSeverity = (severity: AlertVariant): IconName => {
  switch (severity) {
    case 'error':
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
  const borderRadius = theme.shape.borderRadius();
  const borderColor = tinycolor2(color.border).setAlpha(0.2).toString();

  return {
    alert: css`
      flex-grow: 1;
      position: relative;
      border-radius: ${borderRadius};
      display: flex;
      flex-direction: row;
      align-items: stretch;
      background: ${color.transparent};
      box-shadow: ${elevated ? theme.shadows.z3 : 'none'};
      padding: ${theme.spacing(1, 2)};
      border: 1px solid ${borderColor};
      margin-bottom: ${theme.spacing(bottomSpacing ?? 2)};
      margin-top: ${theme.spacing(topSpacing ?? 0)};

      &:before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        background: ${theme.colors.background.primary};
        z-index: -1;
      }
    `,
    icon: css`
      padding: ${theme.spacing(1, 2, 0, 0)};
      color: ${color.text};
      display: flex;
    `,
    title: css({
      fontWeight: theme.typography.fontWeightMedium,
    }),
    body: css`
      padding: ${theme.spacing(1, 0)};
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow-wrap: break-word;
      word-break: break-word;
    `,
    content: css`
      padding-top: ${hasTitle ? theme.spacing(0.5) : 0};
      max-height: 50vh;
      overflow-y: auto;
    `,
    buttonWrapper: css`
      margin-left: ${theme.spacing(1)};
      display: flex;
      align-items: center;
      align-self: center;
    `,
    close: css`
      position: relative;
      color: ${theme.colors.text.secondary};
      background: none;
      display: flex;
      top: -6px;
      right: -14px;
    `,
  };
};
