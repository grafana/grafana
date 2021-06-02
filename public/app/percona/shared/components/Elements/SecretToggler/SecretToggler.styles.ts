import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  fieldWrapper: css`
    position: relative;
  `,
  smallPassword: css`
    margin-right: ${spacing.sm};
  `,
  lock: css`
    cursor: pointer;
  `,
  fullLock: css`
    position: absolute;
    right: 7px;
    top: 30px;
  `,
});
