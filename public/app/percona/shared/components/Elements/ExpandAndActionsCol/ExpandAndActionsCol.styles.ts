import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2, center: boolean) => ({
  actionsWrapper: css`
    display: flex;
    justify-content: ${center ? 'center' : 'flex-end'};
    align-items: center;
  `,
});
