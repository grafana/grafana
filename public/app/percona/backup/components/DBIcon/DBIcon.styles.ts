import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors }: GrafanaTheme) => ({
  disabled: css`
    color: ${colors.textFaint};

    svg {
      cursor: not-allowed;
      pointer-events: none;
    }
  `,
});
