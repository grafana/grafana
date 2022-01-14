import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  tabs: css`
    li {
      border: solid ${theme.colors.pageHeaderBorder};
      border-width: ${theme.border.width.sm};
      border-bottom: 0;
      border-radius: 0;
      margin: 0;
      &::before {
        background-image: linear-gradient(#f05a28 30%, #fbca0a 99%);
        height: 100%;
        width: 2px;
      }
      &:first-child {
        border-radius: ${theme.border.radius.md} ${theme.border.radius.md} 0 0;
      }
      &:last-child {
        border-bottom: ${theme.border.width.sm} solid ${theme.colors.pageHeaderBorder};
        border-radius: 0 0 ${theme.border.radius.md} ${theme.border.radius.md};
      }
    }
  `,
}));
