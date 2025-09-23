import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { palette } }: GrafanaTheme2) => ({
  labelWrapper: css`
    display: flex;
    justify-content: space-between;
    width: 100%;
  `,
  label: css`
    display: flex;
    align-items: center;
    color: ${palette.blue85};
    font-size: 12px;
  `,
});
