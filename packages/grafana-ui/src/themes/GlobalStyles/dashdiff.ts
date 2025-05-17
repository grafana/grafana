import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getDashDiffStyles(theme: GrafanaTheme2) {
  return css({
    '.delta-html': {
      background: theme.colors.background.secondary,
      paddingTop: '5px',
      paddingBottom: '5px',
      userSelect: 'none',
    },

    '.diff-line': {
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.size.sm,
      lineHeight: 2,
      marginBottom: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      position: 'relative',

      '&:after': {
        left: '-40px',
      },
    },

    '.diff-line-number': {
      color: theme.colors.text.secondary,
      display: 'inline-block',
      fontSize: theme.typography.size.xs,
      lineHeight: 2.3,
      textAlign: 'right',
      width: '30px',
    },

    '.diff-line-number-hide': {
      visibility: 'hidden',
    },

    '.diff-line-icon': {
      color: theme.colors.text.primary,
      fontSize: theme.typography.size.xs,
      float: 'right',
      position: 'relative',
      top: '2px',
      right: '10px',
    },

    '.diff-json-new, .diff-json-old, .diff-json-deleted, .diff-json-added': {
      color: theme.v1.palette.gray5,

      '.diff-line-number': {
        color: theme.colors.text.primary,
      },
    },

    '.diff-json-new': {
      backgroundColor: theme.isDark ? '#457740' : '#664e33',
    },
    '.diff-json-old': {
      backgroundColor: theme.isDark ? '#a04338' : '#5a372a',
    },
    '.diff-json-added': {
      backgroundColor: theme.colors.primary.shade,
    },
    '.diff-json-deleted': {
      backgroundColor: theme.colors.error.shade,
    },

    '.diff-value': {
      userSelect: 'all',
    },

    // Basic
    '.diff-circle': {
      marginRight: '0.5em',
      '*': {
        marginBottom: '1px',
      },
    },
    '.diff-circle-changed': {
      color: '#f59433',
    },
    '.diff-circle-added': {
      color: '#29d761',
    },
    '.diff-circle-deleted': {
      color: '#fd474a',
    },

    '.diff-item-added, .diff-item-deleted': {
      listStyle: 'none',
    },

    '.diff-group': {
      background: theme.colors.background.secondary,
      fontSize: '16px',
      fontStyle: 'normal',
      padding: '10px 15px',
      margin: theme.spacing(2, 0),

      '.diff-group': {
        padding: '0 5px',
      },
    },

    '.diff-group-name': {
      display: 'inline-block',
      width: '100%',
      fontSize: '16px',
      paddingLeft: '1.75em',
      margin: '0 0 14px 0',
    },

    '.diff-summary-key': {
      paddingLeft: '0.25em',
    },

    '.diff-list': {
      paddingLeft: '40px',

      '.diff-list': {
        paddingLeft: 0,
      },
    },

    '.diff-item': {
      color: theme.v1.palette.gray2,
      lineHeight: 2.5,

      '> div': {
        display: 'inline',
      },
    },

    '.diff-item-changeset': {
      listStyle: 'none',
    },

    '.diff-label': {
      backgroundColor: theme.colors.action.hover,
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.primary,
      display: 'inline',
      fontSize: `${theme.typography.fontSize}px`,
      margin: '0 5px',
      padding: '3px 8px',
    },

    '.diff-linenum': {
      float: 'right',
    },

    '.diff-arrow': {
      color: theme.colors.text.primary,
    },

    '.diff-block': {
      width: '100%',
      display: 'inline-block',
    },

    '.diff-block-title': {
      fontSize: '16px',
      display: 'inline-block',
    },

    '.diff-title': {
      fontSize: '16px',
    },

    '.diff-change-container': {
      margin: '0 0',
      paddingLeft: '3em',
      paddingRight: 0,
    },

    '.diff-change-group': {
      width: '100%',
      color: theme.colors.text.primary,
      marginBottom: '14px',
    },

    '.diff-change-item': {
      display: 'inline-block',
    },

    '.diff-change-title': {
      fontSize: '16px',
    },

    '.bullet-position-container': {
      position: 'relative',
      left: '-6px',
    },

    '.diff-list-circle': {
      marginBottom: '3px',
    },
  });
}
