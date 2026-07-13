import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

import { type GrafanaTheme2 } from '@grafana/data';

import { getFocusStyles } from '../../themes/mixins';

export function createCodeEditorTheme(theme: GrafanaTheme2): Extension {
  const selectionState = EditorView.editorAttributes.compute(
    ['selection'],
    (state): Record<string, string> => (state.selection.main.empty ? {} : { class: 'cm-hasSelection' })
  );
  const editorTheme = EditorView.theme(
    {
      '&': {
        color: theme.components.input.text,
        backgroundColor: theme.components.input.background,
        fontFamily: theme.typography.fontFamilyMonospace,
        fontSize: theme.typography.code.fontSize,
      },
      '&.cm-focused': {
        ...getFocusStyles(theme),
      },
      '.cm-scroller': {
        fontFamily: theme.typography.fontFamilyMonospace,
        lineHeight: `${theme.typography.code.lineHeight}`,
      },
      '.cm-content': {
        caretColor: theme.components.input.text,
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: theme.components.input.text,
      },
      '.cm-gutters': {
        color: theme.colors.text.secondary,
        backgroundColor: theme.components.input.background,
        borderRightColor: theme.components.input.borderColor,
      },
      '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: theme.colors.background.secondary,
      },
      '.cm-activeLineGutter': {
        color: theme.components.input.text,
      },
      '&.cm-hasSelection .cm-activeLine, &.cm-hasSelection .cm-activeLineGutter': {
        backgroundColor: 'transparent',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: `${theme.colors.action.selected} !important`,
      },
      '.cm-selectionMatch': {
        backgroundColor: theme.colors.action.focus,
        outline: `1px solid ${theme.colors.primary.border}`,
      },
      '.cm-matchingBracket': {
        color: theme.colors.text.primary,
        backgroundColor: theme.colors.action.focus,
        outline: `1px solid ${theme.colors.border.strong}`,
      },
      '.cm-panels': {
        color: theme.colors.text.primary,
        backgroundColor: theme.colors.background.secondary,
      },
      '.cm-panels.cm-panels-top': {
        borderBottomColor: theme.colors.border.weak,
      },
      '.cm-panels.cm-panels-bottom': {
        borderTopColor: theme.colors.border.weak,
      },
      '.cm-tooltip': {
        color: theme.colors.text.primary,
        backgroundColor: theme.colors.background.elevated,
        borderColor: theme.colors.border.weak,
        borderRadius: theme.shape.radius.default,
        boxShadow: theme.shadows.z3,
      },
      '.cm-tooltip-autocomplete > ul > li': {
        padding: theme.spacing(0.25, 1),
      },
      '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
        color: theme.colors.text.primary,
        backgroundColor: theme.colors.action.selected,
      },
      '.cm-completionDetail': {
        color: theme.colors.text.secondary,
        fontStyle: 'normal',
      },
      '.cm-completionMatchedText': {
        color: theme.colors.primary.text,
        textDecoration: 'none',
        fontWeight: `${theme.typography.fontWeightBold}`,
      },
      '.cm-foldPlaceholder': {
        color: theme.colors.text.secondary,
        backgroundColor: theme.colors.background.secondary,
        borderColor: theme.colors.border.medium,
      },
    },
    { dark: theme.isDark }
  );

  const syntaxTheme = HighlightStyle.define([
    { tag: [tags.keyword, tags.operatorKeyword, tags.modifier], color: theme.colors.primary.text },
    { tag: [tags.controlKeyword, tags.moduleKeyword], color: theme.colors.tertiary.text },
    {
      tag: [tags.name, tags.propertyName, tags.variableName, tags.labelName, tags.definition(tags.name)],
      color: theme.colors.text.primary,
    },
    {
      tag: [tags.typeName, tags.className, tags.tagName, tags.annotation, tags.namespace],
      color: theme.colors.tertiary.text,
    },
    {
      tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
      color: theme.colors.primary.text,
    },
    { tag: [tags.number, tags.bool, tags.atom], color: theme.colors.warning.text },
    { tag: [tags.string, tags.special(tags.string), tags.character, tags.inserted], color: theme.colors.success.text },
    { tag: [tags.operator, tags.punctuation, tags.separator, tags.brace], color: theme.colors.text.secondary },
    { tag: [tags.regexp, tags.escape], color: theme.colors.warning.text },
    { tag: [tags.meta, tags.comment], color: theme.colors.text.secondary, fontStyle: 'italic' },
    { tag: tags.heading, color: theme.colors.primary.text, fontWeight: `${theme.typography.fontWeightBold}` },
    { tag: tags.strong, fontWeight: `${theme.typography.fontWeightBold}` },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
    { tag: [tags.link, tags.url], color: theme.colors.text.link, textDecoration: 'underline' },
    { tag: [tags.invalid, tags.deleted], color: theme.colors.error.text },
  ]);

  return [selectionState, editorTheme, syntaxHighlighting(syntaxTheme)];
}
