import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  sshKeyWrapper: css`
    display: flex;
    flex-direction: column;
  `,
  textarea: css`
    margin: ${spacing.md} 0;
    min-height: 150px;
  `,
});
