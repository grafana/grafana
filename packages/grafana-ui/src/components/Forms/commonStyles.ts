import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getFocusStyle = (theme: GrafanaTheme) => css`
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${theme.colors.blueLight};
  }
`;
