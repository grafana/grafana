import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  form: css`
    display: flex;
  `,
  input: css`
    flex-grow: 1;
  `,
  button: css`
    height: 37px;
    margin-left: ${spacing.md};
    margin-top: 20px;
  `,
});
