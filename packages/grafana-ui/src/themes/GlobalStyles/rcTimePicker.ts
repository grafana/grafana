import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getRcTimePickerStyles(theme: GrafanaTheme2) {
  return css({
    '.rc-time-picker-input,.rc-time-picker-panel-input-wrap,.rc-time-picker-panel-inner': {
      backgroundColor: theme.components.input.background,
      color: theme.colors.text.secondary,
      borderColor: theme.components.input.borderColor,
      fontSize: theme.typography.body.fontSize,
    },

    '.rc-time-picker-input': {
      padding: theme.spacing(0, 1),
      height: theme.spacing(4),
    },

    '.rc-time-picker-panel': {
      width: '176px',
    },

    '.rc-time-picker-panel-select': {
      width: '50%',

      '&:only-child': {
        width: '100%',
      },

      '.rc-time-picker-panel-select-option-selected': {
        backgroundColor: theme.colors.background.secondary,
      },

      'li:hover': {
        backgroundColor: theme.colors.background.secondary,
      },
    },

    '.rc-time-picker-panel-narrow': {
      maxWidth: 'none',
    },
  });
}
