import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  stepProgressWrapper: css`
    width: 100%;
  `,
  createButton: css`
    margin: ${spacing.md} ${spacing.xl} ${spacing.md} 0;
  `,
});
