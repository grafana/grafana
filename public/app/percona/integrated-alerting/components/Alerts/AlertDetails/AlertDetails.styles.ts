import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    align-items: center;

    & > * {
      flex: 1 0 50%;
      display: flex;
      align-items: center;

      &:first-child {
        margin-right: ${spacing.md};
      }

      & > span {
        margin-right: ${spacing.md};
      }
    }

    pre {
      margin-bottom: 0;
    }
  `,
});
