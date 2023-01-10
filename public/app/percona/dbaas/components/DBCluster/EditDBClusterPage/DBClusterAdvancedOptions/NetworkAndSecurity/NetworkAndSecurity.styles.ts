import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  errorWrapper: css`
    div:only-child > div {
      display: none;
    },

    margin-bottom: ${spacing.sm};
  `,
  fieldsWrapper: css`
    position: relative;
    width: 100%;
  `,

  button: css`
    position: absolute;
    right: 0;
    top: -${spacing.md};
  `,

  fieldWrapper: css`
    display: flex;
    width: 100%;
    align-items: start;
    column-gap: ${spacing.md};
  `,
  field: css`
    width: 100%;
    margin-bottom: 16px;
  `,

  deleteButton: css`
    height: 37px;
  `,
});
