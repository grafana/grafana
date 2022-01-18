import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  addWrapper: css`
    display: flex;
    justify-content: flex-end;
    margin-bottom: ${spacing.sm};
  `,
});
