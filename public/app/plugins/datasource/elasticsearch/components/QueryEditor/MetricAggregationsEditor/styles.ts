import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

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
