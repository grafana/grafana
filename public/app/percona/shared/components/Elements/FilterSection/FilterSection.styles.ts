import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { colors, spacing } }: GrafanaTheme2) => ({
  collapse: css`
    margin: ${spacing.lg} 0;
    height: auto;

    & > div:first-child {
      background-color: ${colors.bg2};
    }

    & > div:last-child {
      background-color: ${colors.bg1};
    }
  `,
  form: css`
    display: flex;
    flex-wrap: wrap;
    margin: 0 -${spacing.sm};

    & > * {
      margin: 0 ${spacing.md};
      flex: 1 0 calc(50% - 2 * ${spacing.md});
    }
  `,
});
