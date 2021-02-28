import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getSegmentStyles = (theme: GrafanaTheme) => {
  return {
    segment: css`
      cursor: pointer;
      width: auto;
    `,

    queryPlaceholder: css`
      color: ${theme.palette.gray2};
    `,

    disabled: css`
      cursor: not-allowed;
      opacity: 0.65;
      box-shadow: none;
    `,
  };
};
