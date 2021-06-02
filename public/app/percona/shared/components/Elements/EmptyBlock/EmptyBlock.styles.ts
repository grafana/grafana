import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme) => {
  const { colors } = theme;
  const backgroundColorBody = colors.bg1;
  const borderColor = colors.border2;

  return {
    emptyBlockWrapper: css`
      display: flex;
      width: 100%;
      height: 160px;
      justify-content: center;
      align-items: center;
      border: 1px solid ${borderColor};
      background-color: ${backgroundColorBody};
    `,
  };
};
