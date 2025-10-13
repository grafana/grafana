import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ typography, colors, v1: { spacing } }: GrafanaTheme2) => ({
  descriptionFilter: css`
    flex: 1 0 calc(100% - 2 * ${spacing.md});
  `,
  actionButtons: css`
    display: flex;
    flex: 1;
    justify-content: flex-end;
    padding-bottom: ${spacing.sm};
    align-items: center;
  `,
  runChecksButton: css`
    width: 140px;
    justify-content: center;
  `,
  header: css`
    display: flex;
    justify-content: space-between;
  `,
  wrapper: css`
    padding-top: 10px;
    padding-bottom: 10px;
  `,
});
