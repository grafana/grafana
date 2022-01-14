import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = stylesFactory(
  ({ breakpoints, spacing, typography, border, colors, palette }: GrafanaTheme) => {
    return {
      labelWrapper: css`
        position: absolute;
        top: 24px;
        right: 24px;

        h1 {
          font-size: ${typography.size.md};
          color: ${colors.textWeak};
          padding: 5px ${spacing.sm} 5px ${spacing.sm};
          ${border.width.sm} solid ${colors.pageHeaderBorder};
          border-radius: ${border.radius.md};
          user-select: none;
        }
      `,
      link: css`
        color: ${colors.linkExternal};
      `,
    };
  }
);
