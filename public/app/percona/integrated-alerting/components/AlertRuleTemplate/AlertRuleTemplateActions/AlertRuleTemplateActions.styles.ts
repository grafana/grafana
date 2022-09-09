import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme2) => ({
  actionsWrapper: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
  `,
  button: css`
    margin-right: 0;
  `,
  editButton: css`
    margin-left: ${spacing(0.5)};
  `,
  actionLink: css`
    display: flex;
  `,
});
