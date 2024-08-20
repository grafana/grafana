import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getUtilityClassStyles(theme: GrafanaTheme2) {
  return css({
    '.highlight-word': {
      color: theme.v1.palette.orange,
    },
    '.hide': {
      display: 'none',
    },
    '.show': {
      display: 'block',
    },
    '.invisible': {
      // can't avoid type assertion here due to !important
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      visibility: 'hidden !important' as 'hidden',
    },
    '.absolute': {
      position: 'absolute',
    },
    '.flex-grow-1': {
      flexGrow: 1,
    },
    '.flex-shrink-1': {
      flexShrink: 1,
    },
    '.flex-shrink-0': {
      flexShrink: 0,
    },
    '.center-vh': {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      justifyItems: 'center',
    },
  });
}
