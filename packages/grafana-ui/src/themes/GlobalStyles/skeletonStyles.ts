import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

import { getStyles } from '../../utils/skeleton';

export const getSkeletonStyles = (theme: GrafanaTheme2) => {
  return css({
    '.react-loading-skeleton': getStyles(theme),
  });
};
