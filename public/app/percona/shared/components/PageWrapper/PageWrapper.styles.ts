import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';

export const getStyles = stylesFactory(({ spacing }: GrafanaTheme) => {
  return {
    wrapper: css`
      margin: ${spacing.lg};
    `,
  };
});
