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

  childFildSet: css`
    legend {
      font-size: 18px;
    }
    margin-bottom: 0;
  `,
  line: css`
    display: flex;
    gap: ${spacing.lg};
    > div {
      flex: 1 0;
    }
  `,
  asyncSelectField: css`
    background-color: red;
  `,
});
