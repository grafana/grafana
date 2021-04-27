import React from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useStyles } from '../../themes/ThemeContext';

export interface CallToActionCardProps {
  message?: string | JSX.Element;
  callToActionElement: JSX.Element;
  footer?: string | JSX.Element;
  className?: string;
}

export const CallToActionCard: React.FunctionComponent<CallToActionCardProps> = ({
  message,
  callToActionElement,
  footer,
  className,
}) => {
  const css = useStyles(getStyles);

  return (
    <div className={cx([css.wrapper, className])}>
      {message && <div className={css.message}>{message}</div>}
      {callToActionElement}
      {footer && <div className={css.footer}>{footer}</div>}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    label: call-to-action-card;
    padding: ${theme.spacing.lg};
    background: ${theme.colors.bg2};
    border-radius: ${theme.border.radius.md};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-grow: 1;
  `,
  message: css`
    margin-bottom: ${theme.spacing.lg};
    font-style: italic;
  `,
  footer: css`
    margin-top: ${theme.spacing.lg};
  `,
});
