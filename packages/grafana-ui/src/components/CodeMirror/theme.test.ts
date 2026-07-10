import { sql } from '@codemirror/lang-sql';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

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
      extensions: [sql(), createCodeEditorTheme(theme)],
    }),
  });
}

describe.each(['light', 'dark'] as const)('Grafana CodeEditor %s theme', (mode) => {
  it('uses Grafana surface and typography tokens', () => {
    const theme = createTheme({ colors: { mode } });
    const editor = createEditor(theme);

    expect(getComputedStyle(editor.dom).backgroundColor).toBe(normalizeColor(theme.colors.background.primary));
    expect(getComputedStyle(editor.scrollDOM).fontFamily).toContain('Roboto Mono');

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
    ];

    for (const color of syntaxColors) {
      expect(
        colorManipulator.getContrastRatio(theme.colors.background.primary, color, theme.colors.background.primary)
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
