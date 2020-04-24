import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const cardStyle = (theme: GrafanaTheme, complete: boolean) => {
  const borderGradient = complete
    ? 'linear-gradient(to right, #5182CC 0%, #245BAF 100%)'
    : 'linear-gradient(to right, #f05a28 0%, #fbca0a 100%)';

  return `
      background-color: ${theme.colors.bg1};
      margin-right: 16px;
      border: 1px solid ${theme.colors.border1};
      border-bottom-left-radius: ${theme.border.radius.md};
      border-bottom-right-radius: ${theme.border.radius.md};
      position: relative;

      &::before {
        display: block;
        content: ' ';
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        top: 0;
        background-image: ${borderGradient};
      }
`;
};

export const iconStyle = (theme: GrafanaTheme, complete: boolean) => css`
  color: ${complete ? theme.palette.blue95 : theme.colors.textWeak};
`;

export const cardContent = css`
  padding: 24px 16px;
`;
