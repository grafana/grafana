import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

export const getHeaderSeparatorStyle = (theme: GrafanaTheme2) =>
  css({
    width: 1,
    height: theme.spacing(2),
    background: theme.colors.border.medium,
  });
