import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ isLight }: GrafanaTheme) => {
  const iconsFill = isLight ? 'black' : 'rgba(255, 255, 255, 0.8)';

  return {
    icon: css`
      path,
      polygon,
      circle {
        fill: ${iconsFill};
      }
    `,
  };
};
