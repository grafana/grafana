import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';
import { selectThemeVariant, stylesFactory } from '@grafana/ui';

export const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const iconsFill = selectThemeVariant({ light: 'black', dark: 'rgba(255, 255, 255, 0.8)' }, theme.type);

  return {
    icon: css`
      path,
      polygon,
      circle {
        fill: ${iconsFill};
      }
    `,
  };
});
