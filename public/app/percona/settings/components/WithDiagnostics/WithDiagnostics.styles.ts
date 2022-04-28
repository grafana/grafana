import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-direction: column;

    & > :first-child {
      margin-bottom: ${spacing.xl};
    }
  `,
});
