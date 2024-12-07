import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getCommonStyles = (theme: GrafanaTheme2) => ({
  animated: css({
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: `opacity ${theme.transitions.duration.short}ms ease-out`,
    },
  }),
  deemphasize: css({
    opacity: 0.5,
  }),
});
