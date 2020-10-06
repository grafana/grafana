import React, { FC, ReactNode } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useTheme } from '../../themes';
import { Icon } from '../Icon/Icon';
import { IconName } from '../../types/icon';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export interface Props {
  title: string;
  /** On click handler for alert button, mostly used for dismissing the alert */
  onRemove?: (event: React.MouseEvent) => void;
  severity?: AlertVariant;
  children?: ReactNode;
  /** Custom component or text for alert button */
  buttonContent?: ReactNode | string;
  /** @deprecated */
  /** Deprecated use onRemove instead */
  onButtonClick?: (event: React.MouseEvent) => void;
  /** @deprecated */
  /** Deprecated use buttonContent instead */
  buttonText?: string;
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

export const Alert: FC<Props> = ({
  title,
  buttonText,
  onButtonClick,
  onRemove,
  children,
  buttonContent,
  severity = 'error',
}) => {
  const theme = useTheme();
  const styles = getStyles(theme, severity, !!buttonContent);

  return (
    <div className={styles.container}>
      <div className={styles.alert} aria-label={selectors.components.Alert.alert(severity)}>
        <div className={styles.icon}>
          <Icon size="xl" name={getIconFromSeverity(severity) as IconName} />
        </div>
        <div className={styles.body}>
          <div className={styles.title}>{title}</div>
          {children && <div>{children}</div>}
        </div>
        {/* If onRemove is specified, giving preference to onRemove */}
        {onRemove ? (
          <button type="button" className={styles.close} onClick={onRemove}>
            {buttonContent || <Icon name="times" size="lg" />}
          </button>
        ) : onButtonClick ? (
          <button type="button" className="btn btn-outline-danger" onClick={onButtonClick}>
            {buttonText}
          </button>
        ) : null}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme, severity: AlertVariant, outline: boolean) => {
  const { redBase, redShade, greenBase, greenShade, blue80, blue77, white } = theme.palette;
  const backgrounds = {
    error: css`
      background: linear-gradient(90deg, ${redBase}, ${redShade});
    `,
    warning: css`
      background: linear-gradient(90deg, ${redBase}, ${redShade});
    `,
    info: css`
      background: linear-gradient(100deg, ${blue80}, ${blue77});
    `,
    success: css`
      background: linear-gradient(100deg, ${greenBase}, ${greenShade});
    `,
  };

  return {
    container: css`
      z-index: ${theme.zIndex.tooltip};
    `,
    alert: css`
      padding: 15px 20px;
      margin-bottom: ${theme.spacing.xs};
      position: relative;
      color: ${white};
      text-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
      border-radius: ${theme.border.radius.md};
      display: flex;
      flex-direction: row;
      align-items: center;
      ${backgrounds[severity]}
    `,
    icon: css`
      padding: 0 ${theme.spacing.md} 0 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 35px;
    `,
    title: css`
      font-weight: ${theme.typography.weight.semibold};
    `,
    body: css`
      flex-grow: 1;
      margin: 0 ${theme.spacing.md} 0 0;

      a {
        color: ${white};
        text-decoration: underline;
      }
    `,
    close: css`
      background: none;
      display: flex;
      align-items: center;
      border: ${outline ? `1px solid ${white}` : 'none'};
      border-radius: ${theme.border.radius.sm};
    `,
  };
};
