import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors }: GrafanaTheme) => ({
  link: css`
    color: ${colors.linkExternal};
    &:hover {
      color: ${colors.textBlue};
    }
  `,
  unauthorized: css`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateX(-50%) translateY(-50%);
  `,
});
