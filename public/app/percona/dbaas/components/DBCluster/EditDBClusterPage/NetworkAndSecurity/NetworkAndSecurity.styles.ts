import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';
export const getStyles = ({ spacing }: GrafanaTheme) => ({
  fieldSetSwitch: css`
    label {
      position: absolute;
    }
  `,
  fieldSetLabel: css`
    display: flex;
    align-items: center;
    column-gap: 10px;
  `,
  fieldsWrapper: css`
    position: relative;
    width: 100%;
    div:first-of-type {
      button {
        margin-top: 25px;
      }
    }
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
