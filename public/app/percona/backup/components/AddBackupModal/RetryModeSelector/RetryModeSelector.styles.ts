import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors, typography, spacing, border }: GrafanaTheme) => ({
  retryFields: css`
    display: flex;
  `,
  retrySelect: css`
    flex: 1 1 50%;

    &:first-child {
      padding-right: ${spacing.sm};
    }

    &:last-child {
      padding-left: ${spacing.sm};
    }
  `,
});
