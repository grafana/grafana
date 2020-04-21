import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const cardStyle = (theme: GrafanaTheme, complete: boolean) => `
      background-color: ${theme.colors.bg1};
      margin-right: 16px;
      border: 1px solid ${theme.colors.border1};
      border-top: 1px solid ${complete ? '#245BAF' : '#FFB357'};
      border-bottom-left-radius: ${theme.border.radius.md};
      border-bottom-right-radius: ${theme.border.radius.md};
`;

export const cardContent = css`
  padding: 24px 16px;
`;
