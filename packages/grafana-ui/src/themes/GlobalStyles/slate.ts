import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getSlateStyles(theme: GrafanaTheme2) {
  return css({
    '.slate-query-field': {
      fontSize: theme.typography.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      height: 'auto',
      wordBreak: 'break-word',
      // Affects only placeholder in query field. Adds scrollbar only if content is cropped.
      overflow: 'auto',
    },

    '.slate-query-field__wrapper': {
      position: 'relative',
      display: 'inline-block',
      padding: '6px 8px',
      minHeight: '32px',
      width: '100%',
      color: theme.colors.text.primary,
      backgroundColor: theme.components.input.background,
      backgroundImage: 'none',
      border: `1px solid ${theme.components.input.borderColor}`,
      borderRadius: theme.shape.radius.default,
      transition: 'all 0.3s',
      lineHeight: '18px',
    },

    '.slate-query-field__wrapper--disabled': {
      backgroundColor: 'inherit',
      cursor: 'not-allowed',
    },

    '.slate-typeahead': {
      '.typeahead': {
        position: 'relative',
        zIndex: theme.zIndex.typeahead,
        borderRadius: theme.shape.radius.default,
        border: `1px solid ${theme.components.panel.borderColor}`,
        maxHeight: '66vh',
        overflowY: 'scroll',
        overflowX: 'hidden',
        outline: 'none',
        listStyle: 'none',
        background: theme.components.panel.background,
        color: theme.colors.text.primary,
        boxShadow: theme.shadows.z2,
      },

      '.typeahead-group__title': {
        color: theme.colors.text.secondary,
        fontSize: theme.typography.size.sm,
        lineHeight: theme.typography.body.lineHeight,
        padding: theme.spacing(1),
      },

      '.typeahead-item': {
        height: 'auto',
        fontFamily: theme.typography.fontFamilyMonospace,
        padding: theme.spacing(1, 1, 1, 2),
        fontSize: theme.typography.size.sm,
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        zIndex: 1,
        display: 'block',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition:
          'color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), border-color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), background 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), padding 0.15s cubic-bezier(0.645, 0.045, 0.355, 1)',
      },

      '.typeahead-item__selected': {
        backgroundColor: theme.isDark ? theme.v1.palette.dark9 : theme.v1.palette.gray6,

        '.typeahead-item-hint': {
          fontSize: theme.typography.size.xs,
          color: theme.colors.text.primary,
          whiteSpace: 'normal',
        },
      },

      '.typeahead-match': {
        color: theme.v1.palette.yellow,
        borderBottom: `1px solid ${theme.v1.palette.yellow}`,
        // Undoing mark styling
        padding: 'inherit',
        background: 'inherit',
      },
    },

    /* SYNTAX */

    '.slate-query-field, .prism-syntax-highlight': {
      '.token.comment, .token.block-comment, .token.prolog, .token.doctype, .token.cdata': {
        color: theme.colors.text.secondary,
      },

      '.token.variable, .token.entity': {
        color: theme.colors.text.primary,
      },

      '.token.property, .token.tag, .token.constant, .token.symbol, .token.deleted': {
        color: theme.colors.error.text,
      },

      '.token.attr-value, .token.selector, .token.string, .token.char, .token.builtin, .token.inserted': {
        color: theme.colors.success.text,
      },

      '.token.boolean, .token.number, .token.operator, .token.url': {
        color: '#fe85fc',
      },

      '.token.function, .token.attr-name, .token.function-name, .token.atrule, .token.keyword, .token.class-name': {
        color: theme.colors.primary.text,
      },

      '.token.punctuation, .token.regex, .token.important': {
        color: theme.v1.palette.orange,
      },

      '.token.important': {
        fontWeight: 'normal',
      },

      '.token.bold': {
        fontWeight: 'bold',
      },

      '.token.italic': {
        fontStyle: 'italic',
      },

      '.token.entity': {
        cursor: 'help',
      },

      '.namespace': {
        opacity: 0.7,
      },
    },
  });
}
