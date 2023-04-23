import { css, cx } from '@emotion/css';
import React, { AriaRole, HTMLAttributes, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useTheme2, IconName, Button, Icon, IconButton, AlertVariant, Link } from '@grafana/ui';

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
  successMessage?: ReactNode;
  exploreUrl: string;
  canExploreDataSources: boolean;
  dataSourceId: string;
  onDashboardLinkClicked: any;
}

export function getIconFromSeverity(severity: AlertVariant): IconName {
  switch (severity) {
    case 'error':
    case 'warning':
      return 'times-circle';
    case 'info':
      return 'info-circle';
    case 'success':
      return 'check';
  }
}

const createDashboardLinkText = `creating a dashboard`;
const exploreDataLinkText = `exploring the data`;

export const DataSourceConfigAlert = React.forwardRef<HTMLDivElement, Props>(
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
      exploreUrl,
      canExploreDataSources,
      dataSourceId,
      onDashboardLinkClicked,
      ...restProps
    },
    ref
  ) => {
    const theme = useTheme2();
    const hasTitle = Boolean(title);
    const styles = getStyles(theme, severity, hasTitle, elevated, bottomSpacing, topSpacing);
    const rolesBySeverity: Record<AlertVariant, AriaRole> = {
      error: 'alert',
      info: 'status',
      success: 'status',
      warning: 'warning',
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
          {severity === 'success' && (
            <div className={styles.content}>
              Next, you can analyze the data by &nbsp;
              <Link
                aria-label={`Create a dashboard`}
                href={`../../dashboard/new-with-ds/${dataSourceId}`}
                className={styles.link}
                onClick={onDashboardLinkClicked}
              >
                {createDashboardLinkText}
              </Link>
              , or &nbsp;
              <Link
                aria-label={`Explore data`}
                className={cx(styles.link, { [`${styles.disabled}`]: !canExploreDataSources })}
                href={exploreUrl}
              >
                {exploreDataLinkText}
              </Link>
              .
            </div>
          )}
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

DataSourceConfigAlert.displayName = 'Alert';

const getStyles = (
  theme: GrafanaTheme2,
  severity: AlertVariant,
  hasTitle: boolean,
  elevated?: boolean,
  bottomSpacing?: number,
  topSpacing?: number,
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
      background: ${theme.colors.background.secondary};
      box-shadow: ${elevated ? theme.shadows.z3 : theme.shadows.z1};
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
      padding: ${theme.spacing(2, 2)};
      background: ${color.main};
      border-radius: ${borderRadius} 0 0 ${borderRadius};
      color: ${color.contrastText};
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    title: css`
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.text.primary};
      font-size: ${theme.typography.size.sm};
    `,
    body: css`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.size.sm};
      padding: ${theme.spacing(2)};
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow-wrap: break-word;
      word-break: break-word;
    `,
    content: css`
      color: ${theme.colors.text.secondary};
      padding-top: ${hasTitle ? theme.spacing(1) : 0};
      max-height: 50vh;
      overflow-y: auto;
    `,
    link: css`
      color: ${theme.colors.primary.text};
      text-decoration: underline;
    `,
    disabled: css`
      pointer-events: none;
      color: ${theme.colors.text.secondary};
    `,
    buttonWrapper: css`
      padding: ${theme.spacing(1)};
      background: none;
      display: flex;
      align-items: center;
    `,
    close: css`
      padding: ${theme.spacing(2, 1)};
      background: none;
      display: flex;
    `,
  };
};
