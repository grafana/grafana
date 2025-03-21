import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  evaluationGroup: css`
    & {
      margin-bottom: ${theme.spacing(2)};
    }

    /* Remove border and padding from outer wrapper */
    & > div {
      border: none;
      padding: 0;
      gap: 0;
    }

    /* Hide step and step description */
    fieldset > legend {
      display: none;
    }

    /* Hide description */
    fieldset > div > div:first-child {
      display: none;
    }

    /* Bring elements closer together */
    fieldset > div > div:last-child > div:first-child {
      margin-bottom: -${theme.spacing(3)};
    }
  `,
});
