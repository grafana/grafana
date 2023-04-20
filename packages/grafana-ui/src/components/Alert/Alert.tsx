import { css, cx } from '@emotion/css';
import React, { AriaRole, HTMLAttributes, ReactNode } from 'react';
import tinycolor2 from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes';
import { IconName } from '../../types/icon';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';

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
            <IconButton aria-label="Close alert" name="times" onClick={onRemove} size="lg" type="button" />
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
      border: 1px solid ${tinycolor2(color.border).setAlpha(0.2).toString()};
      margin-bottom: ${theme.spacing(bottomSpacing ?? 2)};
      margin-top: ${theme.spacing(topSpacing ?? 0)};
    `,
    icon: css`
      padding-right: ${theme.spacing(2)};
      //background: ${color.main};
      //border-radius: ${borderRadius} 0 0 ${borderRadius};
      color: ${color.text};
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    title: css`
      //font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.text.primary};
    `,
    body: css`
      color: ${theme.colors.text.secondary};
      padding: ${theme.spacing(1, 0)};
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow-wrap: break-word;
      word-break: break-word;
    `,
    content: css`
      color: ${theme.colors.text.secondary};
      padding-top: ${hasTitle ? theme.spacing(0.5) : 0};
      max-height: 50vh;
      overflow-y: auto;
    `,
    buttonWrapper: css`
      padding: ${theme.spacing(1)};
      background: none;
      display: flex;
      align-items: center;
    `,
    close: css`
      padding: ${theme.spacing(2, 1)};
      color: ${theme.colors.text.secondary};
      background: none;
      display: flex;
    `,
  };
};
