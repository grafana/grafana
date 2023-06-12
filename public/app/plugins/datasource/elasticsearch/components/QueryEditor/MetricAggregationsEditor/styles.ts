import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2, hidden: boolean) => {
  return {
    color:
      hidden &&
      css`
        &,
        &:hover,
        label,
        a {
          color: ${hidden ? theme.colors.text.disabled : theme.colors.text.primary};
        }
      `,
  };
};
