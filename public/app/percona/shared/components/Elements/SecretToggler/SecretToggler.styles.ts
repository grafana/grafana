import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  fieldWrapper: css`
    position: relative;
  `,
  smallPassword: css`
    margin-right: ${spacing.sm};
  `,
  lock: css`
    cursor: pointer;
  `,
  fullLock: css`
    position: absolute;
    right: 7px;
    top: 34px;
  `,
});
