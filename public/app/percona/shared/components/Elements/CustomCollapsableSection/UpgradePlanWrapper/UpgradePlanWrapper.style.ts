import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ typography, colors, v1: { spacing } }: GrafanaTheme2) => ({
  children: css`
    display: flex;
    flex-direction: column;
    gap: ${spacing.sm};
  `,
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: ${spacing.sm};
  `,
  headerLabel: css`
    font-weight: ${typography.fontWeightBold};
    display: flex;
    align-items: center;
    gap: ${spacing.sm};
  `,
  wrapper: css`
    padding-top: ${spacing.sm};
    padding-bottom: ${spacing.sm};
  `,
});
