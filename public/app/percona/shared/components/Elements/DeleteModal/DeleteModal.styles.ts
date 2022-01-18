import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme) => ({
  deleteModalContent: css`
    margin-bottom: ${theme.spacing.xl};
    text-align: center;
    word-break: break-word;
  `,
});
