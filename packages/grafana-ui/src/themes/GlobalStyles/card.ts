import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getCardStyles(theme: GrafanaTheme2) {
  return css({
    '.card-section': {
      marginBottom: theme.spacing(4),
    },

    '.card-list': {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      listStyleType: 'none',
    },

    '.card-item': {
      display: 'block',
      height: '100%',
      background: theme.colors.background.secondary,
      boxShadow: 'none',
      padding: theme.spacing(2),
      borderRadius: theme.shape.radius.default,

      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      },

      '.label-tag': {
        marginLeft: theme.spacing(1),
        fontSize: '11px',
        padding: '2px 6px',
      },
    },

    '.card-item-body': {
      display: 'flex',
      overflow: 'hidden',
    },

    '.card-item-details': {
      overflow: 'hidden',
    },

    '.card-item-header': {
      marginBottom: theme.spacing(2),
    },

    '.card-item-type': {
      color: theme.colors.text.secondary,
      textTransform: 'uppercase',
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.fontWeightMedium,
    },

    '.card-item-badge': {
      margin: '6px 0',
    },

    '.card-item-notice': {
      fontSize: theme.typography.size.sm,
    },

    '.card-item-name': {
      color: theme.colors.text.primary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      width: '100%',
    },

    '.card-item-label': {
      marginLeft: theme.spacing(1),
    },

    '.card-item-sub-name': {
      color: theme.colors.text.secondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      width: '100%',
    },

    '.card-item-sub-name--header': {
      color: theme.colors.text.secondary,
      textTransform: 'uppercase',
      marginBottom: theme.spacing(2),
      fontSize: theme.typography.size.sm,
      fontWeight: 'bold',
    },

    '.card-list-layout-grid': {
      '.card-item-type': {
        display: 'inline-block',
      },

      '.card-item-notice': {
        fontSize: theme.typography.size.sm,
        display: 'inline-block',
        marginLeft: theme.spacing(2),
      },

      '.card-item-header-action': {
        float: 'right',
      },

      '.card-item-wrapper': {
        width: '100%',
        padding: theme.spacing(0, 2, 2, 0),
      },

      '.card-item-wrapper--clickable': {
        cursor: 'pointer',
      },

      '.card-item-figure': {
        margin: theme.spacing(0, 2, 2, 0),
        height: '80px',

        img: {
          width: '80px',
        },
      },

      '.card-item-name': {
        fontSize: theme.typography.h3.fontSize,
      },

      [theme.breakpoints.up('md')]: {
        '.card-item-wrapper': {
          width: '50%',
        },
      },

      [theme.breakpoints.up('lg')]: {
        '.card-item-wrapper': {
          width: '33.333333%',
        },
      },

      '&.card-list-layout-grid--max-2-col': {
        [theme.breakpoints.up('lg')]: {
          '.card-item-wrapper': {
            width: '50%',
          },
        },
      },
    },

    '.card-list-layout-list': {
      '.card-item-wrapper': {
        padding: 0,
        width: '100%',
        marginBottom: theme.spacing(1),
      },

      '.card-item-wrapper--clickable': {
        cursor: 'pointer',
      },

      '.card-item': {
        borderRadius: theme.shape.radius.default,
      },

      '.card-item-header': {
        float: 'right',
        textAlign: 'right',
      },

      '.card-item-figure': {
        margin: theme.spacing(0, 2, 0, 0),
        img: {
          width: '48px',
        },
      },

      '.card-item-name': {
        fontSize: theme.typography.h4.fontSize,
      },

      '.card-item-sub-name': {
        fontSize: theme.typography.size.sm,
      },

      '.layout-selector': {
        marginRight: 0,
      },
    },
  });
}
