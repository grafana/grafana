import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getFocusStyle = (theme: GrafanaTheme) => css`
  &[focus],
  &:focus {
    &:before {
      content: '';
      position: absolute;
      border: 2px solid ${theme.colors.blueLight};
      border-radius: ${theme.border.radius.lg};
      background-color: ${theme.colors.bodyBg};
      height: calc(100% + 8px);
      width: calc(100% + 8px);
      top: -4px;
      left: -4px;
      z-index: -1;
    }
  }
`;
