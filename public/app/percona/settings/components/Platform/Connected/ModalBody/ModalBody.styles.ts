import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { colors } }: GrafanaTheme2) => ({
  link: css`
    color: ${colors.linkExternal};
    &:hover {
      color: ${colors.textBlue};
    }
  `,
});
