import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  emptyBlockWrapper: css`
    display: flex;
    width: 100%;
    height: 160px;
    justify-content: center;
    align-items: center;
    border-radius: ${theme.shape.borderRadius(2)};
    background: ${theme.colors.background.secondary};
  `,
});
