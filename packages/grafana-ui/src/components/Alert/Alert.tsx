import React, { FC, HTMLAttributes, ReactNode } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useTheme } from '../../themes';
import { Icon } from '../Icon/Icon';
import { IconName } from '../../types/icon';
import { getColorsFromSeverity } from '../../utils/colors';
import tinycolor from 'tinycolor2';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export interface Props extends HTMLAttributes<HTMLDivElement> {
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

export const Alert: FC<Props> = React.forwardRef<HTMLDivElement, Props>(
  ({ title, buttonText, onButtonClick, onRemove, children, buttonContent, severity = 'error', ...restProps }, ref) => {
    const theme = useTheme();
    const styles = getStyles(theme, severity, !!buttonContent);

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
    );
  }
);

Alert.displayName = 'Alert';

const getStyles = (theme: GrafanaTheme, severity: AlertVariant, outline: boolean) => {
  const { white } = theme.palette;
  const severityColors = getColorsFromSeverity(severity, theme);
  let borderColor = '';
  let bgColor = '';
  let textColor = theme.colors.text;
  const sourceColor = severityColors[0];

  if (theme.isDark) {
    bgColor = tinycolor(sourceColor).setAlpha(0.1).toString();
    borderColor = tinycolor(sourceColor).darken(20).toString();
    textColor = tinycolor(sourceColor).lighten(30).toString();
  } else {
    bgColor = tinycolor(sourceColor).setAlpha(0.1).toString();
    borderColor = tinycolor(sourceColor).lighten(20).toString();
    textColor = tinycolor(sourceColor).darken(30).toString();
  }

  return {
    alert: css`
      flex-grow: 1;
      padding: 15px 20px;
      margin-bottom: ${theme.spacing.xs};
      position: relative;
      color: ${textColor};
      border-radius: ${theme.border.radius.sm};
      display: flex;
      flex-direction: row;
      align-items: center;
      background: ${bgColor};
      border: 1px solid ${borderColor};
    `,
    icon: css`
      padding: 0 ${theme.spacing.md} 0 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 35px;
    `,
    title: css``,
    body: css`
      flex-grow: 1;
      margin: 0 ${theme.spacing.md} 0 0;
      overflow-wrap: break-word;
      word-break: break-word;

      a {
        color: ${white};
        text-decoration: underline;
      }
    `,
    close: css`
      background: none;
      display: flex;
      align-items: center;
      border: ${outline ? `1px solid ${textColor}` : 'none'};
      border-radius: ${theme.border.radius.sm};
    `,
  };
};
