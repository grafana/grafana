import React, { FC, HTMLAttributes, ReactNode } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useTheme } from '../../themes';
import { Icon } from '../Icon/Icon';
import { IconName } from '../../types/icon';
import { IconButton } from '../IconButton/IconButton';
import { Button } from '../Button/Button';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  title: string;
  /** On click handler for alert button, mostly used for dismissing the alert */
  onRemove?: (event: React.MouseEvent) => void;
  severity?: AlertVariant;
  children?: ReactNode;
  elevated?: boolean;
  buttonContent?: React.ReactNode | string;
}

function getIconFromSeverity(severity: AlertVariant): string {
  switch (severity) {
    case 'error':
    case 'warning':
      return 'exclamation-triangle';
    case 'info':
      return 'info-circle';
    case 'success':
      return 'check';
    default:
      return '';
  }
}

export const Alert: FC<Props> = React.forwardRef<HTMLDivElement, Props>(
  ({ title, onRemove, children, buttonContent, elevated, severity = 'error', ...restProps }, ref) => {
    const theme = useTheme();
    const styles = getStyles(theme, severity, elevated);

    return (
      <div ref={ref} className={styles.alert} aria-label={selectors.components.Alert.alert(severity)} {...restProps}>
        <div className={styles.icon}>
          <Icon size="xl" name={getIconFromSeverity(severity) as IconName} />
        </div>
        <div className={styles.body}>
          <div className={styles.title}>{title}</div>
          {children && <div>{children}</div>}
        </div>
        {/* If onRemove is specified, giving preference to onRemove */}
        {onRemove && !buttonContent && (
          <IconButton name="times" className={styles.close} onClick={onRemove} size="lg" />
        )}
        {onRemove && buttonContent && (
          <Button variant="secondary" onClick={onRemove}>
            {buttonContent}
          </Button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

const getStyles = (theme: GrafanaTheme, severity: AlertVariant, elevated?: boolean) => {
  const color = theme.v2.palette[severity];

  return {
    alert: css`
      flex-grow: 1;
      padding: ${theme.v2.spacing(2)};
      margin-bottom: ${theme.v2.spacing(0.5)};
      position: relative;
      border-radius: ${theme.v2.shape.borderRadius()};
      display: flex;
      flex-direction: row;
      align-items: center;
      border-left: 3px solid ${color.border};
      background: ${color.transparent};
      box-shadow: ${elevated ? theme.v2.shadows.z4 : theme.v2.shadows.z1};

      &:before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        background: ${theme.v2.palette.layer1};
        z-index: -1;
      }
    `,
    icon: css`
      padding-right: ${theme.v2.spacing(2)};
      color: ${color.border};
      display: flex;
      align-items: center;
      justify-content: center;
      width: 35px;
    `,
    title: css`
      font-weight: ${theme.v2.typography.fontWeightMedium};
    `,
    body: css`
      flex-grow: 1;
      margin: ${theme.v2.spacing(0, 1, 0, 0)};
      overflow-wrap: break-word;
      word-break: break-word;
    `,
    close: css`
      background: none;
      display: flex;
      align-items: center;
    `,
  };
};
