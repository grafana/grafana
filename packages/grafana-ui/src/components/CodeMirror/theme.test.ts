import { sql } from '@codemirror/lang-sql';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView, highlightActiveLine, highlightActiveLineGutter, lineNumbers } from '@codemirror/view';

import { colorManipulator, createTheme, type GrafanaTheme2 } from '@grafana/data';

import { createCodeEditorTheme } from './theme';

function normalizeColor(color: string): string {
  const element = document.createElement('div');
  element.style.color = color;
  document.body.appendChild(element);
  const normalizedColor = getComputedStyle(element).color;
  element.remove();
  return normalizedColor;
}

function createEditor(theme: GrafanaTheme2): EditorView {
  return new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc: 'SELECT value_with_underscores FROM metrics',
      extensions: [
        sql(),
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        createCodeEditorTheme(theme),
      ],
    }),
  });
}

describe.each(['light', 'dark'] as const)('Grafana CodeEditor %s theme', (mode) => {
  it('uses Grafana surface and typography tokens', () => {
    const theme = createTheme({ colors: { mode } });
    const editor = createEditor(theme);

    expect(getComputedStyle(editor.dom).backgroundColor).toBe(normalizeColor(theme.components.input.background));
    expect(getComputedStyle(editor.dom).color).toBe(normalizeColor(theme.components.input.text));
    expect(getComputedStyle(editor.scrollDOM).fontFamily).toContain('Roboto Mono');
    expect(getComputedStyle(editor.dom.querySelector('.cm-gutters')!).borderRightColor).toBe(
      normalizeColor(theme.components.input.borderColor)
    );
    expect(getComputedStyle(editor.contentDOM.querySelector('.cm-activeLine')!).backgroundColor).toBe(
      normalizeColor(theme.colors.background.secondary)
    );

    editor.destroy();
    editor.dom.remove();
  });

  it('uses the Grafana focus treatment', () => {
    const theme = createTheme({ colors: { mode } });
    const editor = createEditor(theme);
    const focusRule = Array.from(document.styleSheets)
      .flatMap((styleSheet) => Array.from(styleSheet.cssRules))
      .find((rule) => rule.cssText.includes('cm-focused') && rule.cssText.includes('box-shadow'));

    expect(focusRule?.cssText).toContain('outline: 2px dotted transparent');
    expect(focusRule?.cssText).toContain('box-shadow');

    editor.destroy();
    editor.dom.remove();
  });

  it('removes the active-line treatment while text is selected', () => {
    const theme = createTheme({ colors: { mode } });
    const editor = createEditor(theme);
    const activeLine = editor.contentDOM.querySelector('.cm-activeLine')!;

    editor.dispatch({ selection: EditorSelection.range(0, 6) });

    expect(editor.dom).toHaveClass('cm-hasSelection');
    expect(getComputedStyle(activeLine).backgroundColor).toBe('transparent');

    editor.dispatch({ selection: EditorSelection.cursor(0) });

    expect(editor.dom).not.toHaveClass('cm-hasSelection');
    expect(getComputedStyle(activeLine).backgroundColor).toBe(normalizeColor(theme.colors.background.secondary));

    editor.destroy();
    editor.dom.remove();
  });

  it('uses an accessible semantic color for SQL keywords', () => {
    const theme = createTheme({ colors: { mode } });
    const editor = createEditor(theme);
    const keyword = editor.contentDOM.querySelector('span');

    expect(keyword).not.toBeNull();
    expect(getComputedStyle(keyword!).color).toBe(normalizeColor(theme.colors.primary.text));

    editor.destroy();
    editor.dom.remove();
  });

  it('keeps syntax colors above the WCAG AA text contrast threshold', () => {
    const theme = createTheme({ colors: { mode } });
    const syntaxColors = [
      theme.colors.text.primary,
      theme.colors.text.secondary,
      theme.colors.primary.text,
      theme.colors.tertiary.text,
      theme.colors.success.text,
      theme.colors.warning.text,
      theme.colors.error.text,
      theme.colors.text.link,
    ];
    const syntaxBackgrounds = [
      theme.components.input.background,
      theme.colors.background.primary,
      theme.colors.background.secondary,
    ];

    for (const background of syntaxBackgrounds) {
      for (const color of syntaxColors) {
        expect(colorManipulator.getContrastRatio(background, color, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
