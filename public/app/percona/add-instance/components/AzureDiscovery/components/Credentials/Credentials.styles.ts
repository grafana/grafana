import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  instanceForm: css`
    padding: 0px;
    margin-bottom: ${spacing.sm};
    width: 100%;
  `,
  searchPanel: css`
    display: flex;
    justify-content: space-between;
    width: 100%;
    align-items: baseline;
  `,
  credentialsField: css`
    width: 48%;
  `,
  credentialsSubmit: css`
    margin-top: 2px;
    margin-left: ${spacing.md};
    margin-right: ${spacing.sm};
  `,
});
