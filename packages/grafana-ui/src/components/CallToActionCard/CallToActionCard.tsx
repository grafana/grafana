import React from 'react';
import { Themeable, GrafanaTheme } from '../../types/theme';
import { selectThemeVariant } from '../../themes/selectThemeVariant';
import { css } from 'emotion';

export interface CallToActionCardProps extends Themeable {
  message?: string | JSX.Element;
  callToActionElement: JSX.Element;
  footer?: string | JSX.Element;
}

const getCallToActionCardStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    label: call-to-action-card;
    padding: ${theme.spacing.md};
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
});

export const CallToActionCard: React.FunctionComponent<CallToActionCardProps> = ({
  message,
  callToActionElement,
  footer,
  theme,
}) => {
  const css = getCallToActionCardStyles(theme);

  return (
    <div className={css.wrapper}>
      {message && <div className={css.message}>{message}</div>}
      {callToActionElement}
      {footer && <div className={css.footer}>{footer}</div>}
    </div>
  );
};
