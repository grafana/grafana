import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data/src';

export const getPaginationStyles = (theme: GrafanaTheme2) => {
  return css({
    float: 'none',
    display: 'flex',
    justifyContent: 'flex-start',
    margin: theme.spacing(2, 0),
  });
};
