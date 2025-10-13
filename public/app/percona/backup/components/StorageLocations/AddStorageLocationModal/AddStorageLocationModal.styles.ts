import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ palette, border }: GrafanaTheme) => ({
  button: css`
    min-width: 80px;
    justify-content: center;
  `,
  testButton: css`
    background: linear-gradient(180deg, ${palette.greenBase} 0%, ${palette.greenShade} 100%);
    border: ${border.width.sm} solid ${palette.greenShade};
    transition: none;

    &:hover,
    &:focus {
      background: ${palette.greenBase};
    }

    &:focus {
      outline: none;
    }
  `,
});
