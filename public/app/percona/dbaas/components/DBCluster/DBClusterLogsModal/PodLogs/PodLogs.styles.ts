import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';

export const getStyles = ({ spacing, typography }: GrafanaTheme) => ({
  label: css`
    font-size: ${typography.size.lg};
    margin-bottom: ${spacing.md};
  `,
  labelSpacing: css`
    margin-top: ${spacing.sm};
  `,
});
