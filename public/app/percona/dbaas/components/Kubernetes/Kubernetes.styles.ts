import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme) => ({
  actionPanel: css`
    display: flex;
    justify-content: flex-end;
    margin-bottom: ${theme.spacing.sm};
  `,
  actionsColumn: css`
    display: flex;
    justify-content: center;
  `,
  deleteModalContent: css`
    margin-bottom: ${theme.spacing.xl};
  `,
});
