import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2, top?: number, bottom?: number, right?: number, left?: number) => ({
  dot: css({
    position: 'absolute',
    width: 6,
    height: 6,
    top,
    bottom,
    right,
    left,
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.error.main,
  }),
});
