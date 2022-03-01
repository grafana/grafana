import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  detailsWrapper: css`
    display: flex;

    & > span {
      flex: 0 1 50%;
      word-break: break-all;

      &:first-child {
        margin-right: ${spacing.sm};
      }
    }
  `,
  detailLabel: css`
    margin-right: ${spacing.md};
  `,
});
