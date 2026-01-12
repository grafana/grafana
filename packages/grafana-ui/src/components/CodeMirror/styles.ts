import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { GrafanaTheme2 } from '@grafana/data';

/**
 * Creates a generic CodeMirror theme based on Grafana's theme
 */
export function createGenericTheme(theme: GrafanaTheme2): Extension {
  const isDark = theme.colors.mode === 'dark';

  return EditorView.theme(
    {
      '&': {
        fontSize: theme.typography.body.fontSize,
        fontFamily: theme.typography.fontFamilyMonospace,
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
      },
      '.cm-placeholder': {
        color: theme.colors.text.disabled,
        fontStyle: 'normal',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: theme.typography.fontFamilyMonospace,
      },
      '.cm-content': {
        padding: '3px 0',
        color: theme.colors.text.primary,
        caretColor: theme.colors.text.primary,
      },
      '.cm-line': {
        padding: '0 2px',
      },
      '.cm-cursor': {
        borderLeftColor: theme.colors.text.primary,
      },
      '.cm-selectionBackground': {
        backgroundColor: `${theme.colors.action.selected} !important`,
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: `${theme.colors.action.focus} !important`,
      },
      '.cm-activeLine': {
        backgroundColor: 'transparent',
      },
      '.cm-gutters': {
        display: 'none',
      },
      '.cm-tooltip': {
        zIndex: theme.zIndex.portal + 1, // Above modals and portals (1062)
      },
      '.cm-tooltip.cm-tooltip-autocomplete': {
        backgroundColor: theme.colors.background.primary,
        border: `1px solid ${theme.colors.border.weak}`,
        boxShadow: theme.shadows.z3,
      },
      '.cm-tooltip.cm-tooltip-autocomplete > ul': {
        fontFamily: theme.typography.fontFamily,
        maxHeight: '300px',
      },
      '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
        padding: '2px 8px',
        color: theme.colors.text.primary,
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: theme.colors.background.secondary,
        color: theme.colors.text.primary,
      },
      '.cm-completionLabel': {
        fontFamily: theme.typography.fontFamilyMonospace,
        fontSize: theme.typography.size.sm,
      },
      '.cm-completionDetail': {
        color: theme.colors.text.secondary,
        fontStyle: 'normal',
        marginLeft: theme.spacing(1),
      },
      '.cm-completionInfo': {
        backgroundColor: theme.colors.background.primary,
        border: `1px solid ${theme.colors.border.weak}`,
        color: theme.colors.text.primary,
        padding: theme.spacing(1),
      },
    },
    { dark: isDark }
  );
}
