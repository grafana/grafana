import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getJsonFormatterStyles(theme: GrafanaTheme2) {
  return css({
    '.json-formatter-row': {
      fontFamily: 'monospace',

      '&, a, a:hover': {
        color: theme.colors.text.primary,
        textDecoration: 'none',
      },

      '.json-formatter-row': {
        marginLeft: theme.spacing(2),
      },

      '.json-formatter-children': {
        '&.json-formatter-empty': {
          opacity: 0.5,
          marginLeft: theme.spacing(2),

          '&::after': {
            display: 'none',
          },
          '&.json-formatter-object::after': {
            content: "'No properties'",
          },
          '&.json-formatter-array::after': {
            content: "'[]'",
          },
        },
      },

      '.json-formatter-string': {
        color: theme.isDark ? '#23d662' : 'green',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        wordBreak: 'break-all',
      },

      '.json-formatter-number': {
        color: theme.isDark ? theme.colors.primary.text : theme.colors.primary.main,
      },
      '.json-formatter-boolean': {
        color: theme.isDark ? theme.colors.primary.text : theme.colors.error.main,
      },
      '.json-formatter-null': {
        color: theme.isDark ? '#eec97d' : '#855a00',
      },
      '.json-formatter-undefined': {
        color: theme.isDark ? 'rgb(239, 143, 190)' : 'rgb(202, 11, 105)',
      },
      '.json-formatter-function': {
        color: theme.isDark ? '#fd48cb' : '#ff20ed',
      },
      '.json-formatter-url': {
        textDecoration: 'underline',
        color: theme.isDark ? '#027bff' : theme.colors.primary.main,
        cursor: 'pointer',
      },

      '.json-formatter-bracket': {
        color: theme.isDark ? '#9494ff' : theme.colors.primary.main,
      },
      '.json-formatter-key': {
        color: theme.isDark ? '#23a0db' : '#00008b',
        cursor: 'pointer',
        paddingRight: theme.spacing(0.25),
        marginRight: theme.spacing(0.5),
      },

      '.json-formatter-constructor-name': {
        cursor: 'pointer',
      },

      '.json-formatter-array-comma': {
        marginRight: theme.spacing(0.5),
      },

      '.json-formatter-toggler': {
        lineHeight: '16px',
        fontSize: theme.typography.size.xs,
        verticalAlign: 'middle',
        opacity: 0.6,
        cursor: 'pointer',
        paddingRight: theme.spacing(0.25),

        '&::after': {
          display: 'inline-block',
          transition: 'transform 100ms ease-in',
          content: "'►'",
        },
      },

      // Inline preview on hover (optional)
      '> a > .json-formatter-preview-text': {
        opacity: 0,
        transition: 'opacity 0.15s ease-in',
        fontStyle: 'italic',
      },

      '&:hover > a > .json-formatter-preview-text': {
        opacity: 0.6,
      },

      // Open state
      '&.json-formatter-open': {
        '> .json-formatter-toggler-link .json-formatter-toggler::after': {
          transform: 'rotate(90deg)',
        },
        '> .json-formatter-children::after': {
          display: 'inline-block',
        },
        '> a > .json-formatter-preview-text': {
          display: 'none',
        },
        '&.json-formatter-empty::after': {
          display: 'block',
        },
      },
    },
  });
}
