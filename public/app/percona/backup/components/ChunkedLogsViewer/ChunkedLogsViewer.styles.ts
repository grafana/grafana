import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  loadingHolder: css`
    text-align: center;
  `,
  copyBtnHolder: css`
    display: inline-block;
  `,
});
