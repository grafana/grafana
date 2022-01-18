import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  nameWrapper: css`
    display: flex;
    justify-content: space-between;
    align-items: center;

    & > span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
  addWrapper: css`
    display: flex;
    justify-content: flex-end;
    margin-bottom: ${spacing.sm};
  `,
});
