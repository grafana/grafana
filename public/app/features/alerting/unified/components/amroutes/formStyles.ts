import { css } from '@emotion/css';
import { GrafanaThemeV2 } from '@grafana/data';

export const getFormStyles = (theme: GrafanaThemeV2) => {
  return {
    container: css`
      align-items: center;
      display: flex;
      flex-flow: row nowrap;

      & > * + * {
        margin-left: ${theme.spacing(1)};
      }
    `,
    input: css`
      flex: 1;
    `,
    timingContainer: css`
      max-width: ${theme.spacing(33)};
    `,
    smallInput: css`
      width: ${theme.spacing(6.5)};
    `,
  };
};
