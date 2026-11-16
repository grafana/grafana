import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';

import { getFocusStyles } from '../../themes/mixins';

export function createCodeEditorTheme(theme: GrafanaTheme2, options?: { transparent?: boolean }): Extension {
  const background = options?.transparent ? 'transparent' : theme.components.input.background;
  const secondary = theme.colors.secondary;
  const visualRefresh = theme.flags.visualDesignRefresh;
  const selectionState = EditorView.editorAttributes.compute(
    ['selection'],
    (state): Record<string, string> => (state.selection.main.empty ? {} : { class: 'cm-hasSelection' })
  );
  const editorTheme = EditorView.theme(
    {
      '&': {
        color: theme.components.input.text,
        backgroundColor: background,
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
        backgroundColor: background,
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
      // The find/replace panel is built by @codemirror/search, so we can only restyle its DOM.
      '.cm-panel.cm-search': {
        padding: theme.spacing(1, 5, 0.5, 1),
        fontFamily: theme.typography.fontFamily,
        fontSize: theme.typography.bodySmall.fontSize,
        '& input, & button, & label': {
          margin: theme.spacing(0, 0.5, 0.5, 0),
        },
        '& label': {
          display: 'inline-flex',
          alignItems: 'center',
          gap: theme.spacing(0.5),
          height: theme.spacing(theme.components.height.sm),
          marginLeft: theme.spacing(1),
          verticalAlign: 'middle',
          color: theme.colors.text.secondary,
          fontSize: 'inherit',
          cursor: 'pointer',
        },
        '& input[type=checkbox]': {
          margin: 0,
          accentColor: theme.colors.primary.main,
          cursor: 'pointer',
        },
        '& [name=close]': {
          top: theme.spacing(1),
          right: theme.spacing(1),
          width: theme.spacing(theme.components.height.sm),
          height: theme.spacing(theme.components.height.sm),
          borderRadius: theme.shape.radius.default,
          color: theme.colors.text.secondary,
          fontSize: theme.typography.h4.fontSize,
          lineHeight: 1,
          cursor: 'pointer',
          '&:hover': {
            color: theme.colors.text.primary,
            backgroundColor: theme.colors.action.hover,
          },
          '&:focus-visible': getFocusStyles(theme),
        },
      },
      '.cm-textfield': {
        height: theme.spacing(theme.components.height.sm),
        padding: theme.spacing(0, 1),
        verticalAlign: 'middle',
        fontFamily: theme.typography.fontFamilyMonospace,
        fontSize: theme.typography.bodySmall.fontSize,
        color: theme.components.input.text,
        backgroundColor: theme.components.input.background,
        border: `1px solid ${theme.components.input.borderColor}`,
        borderRadius: theme.shape.radius.default,
        '&:hover': {
          borderColor: theme.components.input.borderHover,
        },
        '&:focus': getFocusStyles(theme),
        '&::placeholder': {
          color: theme.colors.text.disabled,
        },
      },
      '.cm-button': {
        // Mirrors the solid secondary <Button> variant.
        color: secondary.contrastText,
        background: visualRefresh ? secondary.background : secondary.main,
        border: `1px solid ${secondary.subtleBorder}`,
        '&:hover': {
          background: visualRefresh ? secondary.backgroundEmphasis : secondary.shade,
          borderColor: secondary.border,
          boxShadow: theme.shadows.z1,
        },
        '&:active': {
          background: visualRefresh ? secondary.background : secondary.main,
        },
        height: theme.spacing(theme.components.height.sm),
        padding: theme.spacing(0, 1),
        verticalAlign: 'middle',
        fontFamily: theme.typography.fontFamily,
        fontSize: theme.typography.bodySmall.fontSize,
        fontWeight: theme.typography.fontWeightMedium,
        borderRadius: theme.shape.radius.default,
        cursor: 'pointer',
        '&:focus-visible': getFocusStyles(theme),
      },
      '.cm-searchMatch': {
        backgroundColor: colorManipulator.alpha(theme.colors.warning.main, 0.3),
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: colorManipulator.alpha(theme.colors.primary.main, 0.45),
        outline: `1px solid ${theme.colors.primary.border}`,
      },
      '.cm-tooltip': {
        color: theme.colors.text.primary,
        backgroundColor: theme.colors.background.elevated,
        borderColor: theme.colors.border.weak,
        borderRadius: theme.shape.radius.default,
        boxShadow: theme.flags.visualDesignRefresh ? theme.shadows.z2 : theme.shadows.z3,
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
    { tag: [tags.keyword, tags.operatorKeyword, tags.modifier], color: theme.components.codeEditor.keyword },
    { tag: [tags.controlKeyword, tags.moduleKeyword], color: theme.components.codeEditor.controlKeyword },
    {
      tag: [tags.name, tags.propertyName, tags.variableName, tags.labelName, tags.definition(tags.name)],
      color: theme.components.codeEditor.variable,
    },
    {
      tag: [tags.typeName, tags.className, tags.tagName, tags.annotation, tags.namespace],
      color: theme.components.codeEditor.type,
    },
    {
      tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
      color: theme.components.codeEditor.function,
    },
    { tag: [tags.number, tags.bool, tags.atom], color: theme.components.codeEditor.number },
    {
      tag: [tags.string, tags.special(tags.string), tags.character, tags.inserted],
      color: theme.components.codeEditor.string,
    },
    {
      tag: [tags.operator, tags.punctuation, tags.separator, tags.brace],
      color: theme.components.codeEditor.operator,
    },
    { tag: [tags.regexp, tags.escape], color: theme.components.codeEditor.regexp },
    { tag: [tags.meta, tags.comment], color: theme.components.codeEditor.comment, fontStyle: 'italic' },
    {
      tag: tags.heading,
      color: theme.components.codeEditor.heading,
      fontWeight: `${theme.typography.fontWeightBold}`,
    },
    { tag: tags.strong, fontWeight: `${theme.typography.fontWeightBold}` },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
    { tag: [tags.link, tags.url], color: theme.components.codeEditor.link, textDecoration: 'underline' },
    { tag: [tags.invalid, tags.deleted], color: theme.components.codeEditor.invalid },
  ]);

  return [selectionState, editorTheme, syntaxHighlighting(syntaxTheme)];
}
