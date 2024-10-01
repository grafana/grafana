import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getQueryEditorStyles(theme: GrafanaTheme2) {
  return css({
    '.query-editor-row': {
      marginBottom: '2px',

      '&--disabled': {
        '.query-keyword': {
          color: theme.colors.text.secondary,
        },
      },
    },
    '.query-keyword': {
      fontWeight: theme.typography.fontWeightMedium,
      color: `${theme.colors.primary.text} !important`,
    },
    '.query-part': {
      backgroundColor: theme.colors.background.secondary,

      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      },
    },
    '.query-segment-operator': {
      color: `${theme.v1.palette.orange} !important`,
    },
    '.tight-form-func': {
      background: theme.colors.background.secondary,
    },

    'input[type="text"].tight-form-func-param': {
      fontSize: theme.typography.bodySmall.fontSize,
      background: 'transparent',
      border: 'none',
      margin: 0,
      padding: 0,
    },

    '.tight-form-func-controls': {
      textAlign: 'center',

      '.fa-arrow-left': {
        float: 'left',
        position: 'relative',
        top: 2,
      },
      '.fa-arrow-right': {
        float: 'right',
        position: 'relative',
        top: 2,
      },
      '.fa-remove': {
        marginLeft: '10px',
      },
    },
  });
}
