import React from 'react';
import { Themeable } from '../../types/theme';
import { GrafanaTheme } from '@grafana/data';
import { selectThemeVariant } from '../../themes/selectThemeVariant';
import { css, cx } from 'emotion';
import { stylesFactory } from '../../themes';

export interface CallToActionCardProps extends Themeable {
  message?: string | JSX.Element;
  callToActionElement: JSX.Element;
  footer?: string | JSX.Element;
  className?: string;
}

const getCallToActionCardStyles = stylesFactory((theme: GrafanaTheme) => ({
  wrapper: css`
    label: call-to-action-card;
    padding: ${theme.spacing.lg};
    background: ${selectThemeVariant({ light: theme.colors.gray6, dark: theme.colors.grayBlue }, theme.type)};
    border-radius: ${theme.border.radius.md};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  `,
  message: css`
    margin-bottom: ${theme.spacing.lg};
    font-style: italic;
  `,
  footer: css`
    margin-top: ${theme.spacing.lg};
  `,
}));

export const CallToActionCard: React.FunctionComponent<CallToActionCardProps> = ({
  message,
  callToActionElement,
  footer,
  theme,
  className,
}) => {
  const css = getCallToActionCardStyles(theme);

  return (
    <div className={cx([css.wrapper, className])}>
      {message && <div className={css.message}>{message}</div>}
      {callToActionElement}
      {footer && <div className={css.footer}>{footer}</div>}
    </div>
  );
};
