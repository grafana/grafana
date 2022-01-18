import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  connectionPasswordWrapper: css`
    display: flex;
  `,
  showPasswordButton: css`
    margin: 0 0 0 ${spacing.md};
  `,
});
