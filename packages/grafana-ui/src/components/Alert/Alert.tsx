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
          <div className={styles.close}>
            <IconButton name="times" onClick={onRemove} size="lg" />
          </div>
        )}
        {onRemove && buttonContent && (
          <div className={styles.buttonWrapper}>
            <Button variant="secondary" onClick={onRemove}>
              {buttonContent}
            </Button>
          </div>
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
      margin-bottom: ${theme.v2.spacing(0.5)};
      position: relative;
      border-radius: ${theme.v2.shape.borderRadius()};
      display: flex;
      flex-direction: row;
      align-items: stretch;
      background: ${theme.v2.palette.layer2};
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
      padding: ${theme.v2.spacing(2, 3)};
      background: ${color.main};
      color: ${color.contrastText};
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    title: css`
      font-weight: ${theme.v2.typography.fontWeightMedium};
      color: ${theme.v2.palette.text.primary};
    `,
    body: css`
      color: ${theme.v2.palette.text.secondary};
      padding: ${theme.v2.spacing(2)};
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow-wrap: break-word;
      word-break: break-word;
    `,
    buttonWrapper: css`
      padding: ${theme.v2.spacing(1)};
      background: none;
      display: flex;
      align-items: center;
    `,
    close: css`
      padding: ${theme.v2.spacing(1)};
      background: none;
      align-items: center;
      display: flex;
    `,
  };
};
