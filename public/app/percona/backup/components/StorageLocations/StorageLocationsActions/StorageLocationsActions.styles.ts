import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  actionsWrapper: css`
    display: flex;
    justify-content: space-around;
  `,
  dropdownField: css`
    display: flex;
    align-items: center;
    gap: ${spacing.sm};
  `,
});
