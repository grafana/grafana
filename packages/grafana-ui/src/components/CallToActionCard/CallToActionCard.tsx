import { css } from '@emotion/core';
import React from 'react';
import { Themeable } from '../../types/theme';
import { GrafanaTheme } from '@grafana/data';
import { selectThemeVariant } from '../../themes/selectThemeVariant';
// import { css, cx } from 'emotion';
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
  // const css = getCallToActionCardStyles(theme);
  const titleStyle = css`
    box-sizing: 'border-box';
    width: 300px;
    height: 200;
  `;
  return (
    <div css={titleStyle}>
      {message && <div>{message}</div>}
      {callToActionElement}
      {footer && <div>{footer}</div>}
    </div>
  );
};
