import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getCodeStyles(theme: GrafanaTheme2) {
  return css({
    'code, pre, kbd, samp': {
      ...theme.typography.code,
      fontSize: theme.typography.bodySmall.fontSize,
      backgroundColor: theme.colors.background.primary,
      color: theme.colors.text.primary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
    },

    code: {
      whiteSpace: 'nowrap',
      padding: '2px 5px',
      margin: '0 2px',
    },

    pre: {
      display: 'block',
      margin: theme.spacing(0, 0, 2),
      lineHeight: theme.typography.body.lineHeight,
      wordBreak: 'break-all',
      wordWrap: 'break-word',
      whiteSpace: 'pre-wrap',
      overflow: 'auto',
      padding: '10px',

      code: {
        padding: 0,
        color: 'inherit',
        whiteSpace: 'pre-wrap',
        backgroundColor: 'transparent',
        border: 0,
      },
    },
  });
}
