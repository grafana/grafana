import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const dashboardCanvasAddButtonHoverStyles = {
  '&:hover,:focus-within': {
    '.dashboard-canvas-controls': {
      opacity: 1,
    },
  },
};

export const getLayoutControlsStyles = (theme: GrafanaTheme2) => ({
  controls: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
    height: theme.spacing(5),
    bottom: 0,
    left: 0,
    minWidth: 'min-content',
  }),
});
