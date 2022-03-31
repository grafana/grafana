import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors }: GrafanaTheme) => ({
  emptyBlock: css`
    margin-top: 40px;
    padding: 8px;
  `,
});
