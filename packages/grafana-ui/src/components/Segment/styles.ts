import { css } from '@emotion/css';

import { GrafanaTheme, GrafanaTheme2 } from '@grafana/data';

export const getSegmentStyles = (theme: GrafanaTheme | GrafanaTheme2) => {
  const palette = 'v1' in theme ? theme.v1.palette : theme.palette;

  return {
    segment: css`
      cursor: pointer;
      width: auto;
    `,

    queryPlaceholder: css`
      color: ${palette.gray2};
    `,

    disabled: css`
      cursor: not-allowed;
      opacity: 0.65;
      box-shadow: none;
    `,
  };
};
