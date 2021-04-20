import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export const getGridStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      display: grid;
      font-style: ${theme.typography.size.sm};
      grid-template-columns: 124px auto;

      @media only screen and (max-width: ${theme.breakpoints.md}) {
        grid-template-columns: 100%;
      }
    `,
    titleCell: css`
      color: ${theme.colors.textHeading};
    `,
    valueCell: css`
      margin-bottom: ${theme.spacing.sm};
    `,
  };
};
