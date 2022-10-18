import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  actionsWrapper: css`
    display: flex;
    justify-content: space-around;
    align-items: center;
  `,
  dropdownField: css`
    display: flex;
    align-items: center;
    gap: ${spacing.sm};
  `,
});
