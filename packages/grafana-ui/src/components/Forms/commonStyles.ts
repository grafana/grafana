import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getFocusStyle = (theme: GrafanaTheme) => css`
  &:focus {
    outline: 2px dotted transparent;
    outline-offset: 2px;
    box-shadow: 0 0 0 2px ${theme.colors.pageBg}, 0 0 0px 4px ${theme.colors.formFocusOutline};
    transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1);
  }
`;
