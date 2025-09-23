import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  collapsedSectionWrapper: css`
    margin: 48px 0 ${spacing.md} 0;
    padding: 0;
    justify-content: start;
    > div,
    legend {
      font-size: 21px;
    }
  `,
  fieldSetWrapper: css`
    margin-top: 48px;
    legend {
      margin-bottom: ${spacing.lg};
    }
  `,
});
