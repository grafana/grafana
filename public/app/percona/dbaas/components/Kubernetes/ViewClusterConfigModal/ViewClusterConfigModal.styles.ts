import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme) => ({
  deleteModalContent: css`
    margin-bottom: ${theme.spacing.xl};
  `,
  overlay: css`
    height: 50vh;
    overflow: scroll;
    margin-top: ${theme.spacing.sm};
    margin-bottom: ${theme.spacing.sm};
  `,
});
