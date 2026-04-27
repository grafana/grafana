import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data/themes';

export const getPaginationStyles = (theme: GrafanaTheme2) => {
  return css({
    float: 'none',
    display: 'flex',
    justifyContent: 'flex-start',
    margin: theme.spacing(2, 0),
  });
};
