import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';

export const getStyles = stylesFactory(({ spacing }: GrafanaTheme) => {
  return {
    wrapper: css`
      margin: ${spacing.lg};
    `,
  };
});
