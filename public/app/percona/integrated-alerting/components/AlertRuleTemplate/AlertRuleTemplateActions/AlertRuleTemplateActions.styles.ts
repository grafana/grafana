import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme2) => ({
  actionsWrapper: css`
    display: flex;
    align-items: center;
    gap: 10px;
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
