import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors, spacing }: GrafanaTheme) => ({
  infoBox: css`
    margin: 10px 0;
    display: flex;
    flex-direction: column;
    flex: 1;
    justify-content: center;
    align-items: center;
    box-sizing: border-box;
    border: 1px solid #292929;
    text-align: center;
    padding: ${spacing.xs};
  `,
  link: css`
    color: ${colors.linkExternal};
    &:hover {
      color: ${colors.textBlue};
    }
  `,
});
