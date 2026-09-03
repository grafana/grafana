import { css } from '@emotion/react';

import { type GrafanaTheme2 } from '@grafana/data';

export function getMarkdownStyles(theme: GrafanaTheme2) {
  return css({
    '.markdown-html': {
      img: {
        maxWidth: '100%',
      },

      'ul, ol': {
        paddingLeft: theme.spacing(3),
        marginBottom: theme.spacing(2),
      },

      // GFM task lists get no class to hook on, so the checkbox stands in for the marker.
      'li:has(> input[type="checkbox"], > p > input[type="checkbox"])': {
        listStyleType: 'none',
      },

      // Pull into the marker gutter so labels line up with sibling list items.
      'li > input[type="checkbox"], li > p > input[type="checkbox"]': {
        marginLeft: theme.spacing(-2.5),
        marginRight: theme.spacing(0.5),
        verticalAlign: 'middle',
      },

      table: {
        marginBottom: theme.spacing(2),
        'td, th': {
          padding: theme.spacing(0.5, 1),
        },
        th: {
          fontWeight: theme.typography.fontWeightMedium,
          background: theme.colors.background.secondary,
        },
      },

      'table, th, td': {
        border: `1px solid ${theme.colors.border.medium}`,
        borderCollapse: 'collapse',
      },

      a: {
        color: theme.colors.text.link,
        textDecoration: 'none',

        '&:hover': {
          color: theme.colors.text.link,
          textDecoration: 'underline',
        },
      },

      'p:last-child': {
        marginBottom: 0,
      },

      'table:last-child, ul:last-child, ol:last-child': {
        marginBottom: 0,
      },
    },
  });
}
