import { css } from '@emotion/css';

import { basicColors, GrafanaTheme2 } from '@grafana/data';

export const getSegmentStyles = (theme: GrafanaTheme2) => {
  return {
    segment: css`
      cursor: pointer;
      width: auto;
    `,

    queryPlaceholder: css`
      color: ${basicColors.gray2};
    `,

    disabled: css`
      cursor: not-allowed;
      opacity: 0.65;
      box-shadow: none;
    `,
  };
};
