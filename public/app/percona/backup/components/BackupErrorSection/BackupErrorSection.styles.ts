import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing, palette, colors }: GrafanaTheme) => ({
  apiErrorCard: css`
    margin-bottom: ${spacing.md};
  `,
  apiErrorSection: css`
    margin-top: ${spacing.sm};
  `,
  errorLine: css`
    &:not(:first-child) {
      margin-top: ${spacing.xs};
    }
  `,
  errorText: css`
    color: ${palette.redBase};
  `,
  readMore: css`
    color: ${colors.linkExternal};
  `,
});
