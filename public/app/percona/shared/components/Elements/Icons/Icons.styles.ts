import { css } from 'emotion';

import { selectThemeVariant, stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

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
