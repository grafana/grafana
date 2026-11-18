import { sql } from '@codemirror/lang-sql';
import { EditorSelection, EditorState, type Extension } from '@codemirror/state';
import { EditorView, highlightActiveLine, highlightActiveLineGutter, lineNumbers } from '@codemirror/view';

import { colorManipulator, createTheme, type GrafanaTheme2 } from '@grafana/data';

import { loadLanguageExtension } from './languageLoader';
import { createCodeEditorTheme } from './theme';

function normalizeColor(color: string): string {
  const element = document.createElement('div');
  element.style.color = color;
  document.body.appendChild(element);
  const normalizedColor = getComputedStyle(element).color;
  element.remove();
  return normalizedColor;
}

function createEditor(
  theme: GrafanaTheme2,
  doc = 'SELECT value_with_underscores FROM metrics',
  language: Extension = sql()
): EditorView {
  return new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      extensions: [
        language,
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

  it('uses the CodeEditor semantic colors for SQL syntax', () => {
    const theme = createTheme({
      colors: { mode },
      components: {
        codeEditor: {
          keyword: '#123456',
          variable: '#654321',
        },
      },
    });
    const editor = createEditor(theme);
    const syntaxSpans = Array.from(editor.contentDOM.querySelectorAll('span'));
    const keyword = syntaxSpans.find((span) => span.textContent === 'SELECT');
    const variable = syntaxSpans.find((span) => span.textContent === 'value_with_underscores');

    expect(keyword).toBeDefined();
    expect(variable).toBeDefined();
    expect(getComputedStyle(keyword!).color).toBe(normalizeColor(theme.components.codeEditor.keyword));
    expect(getComputedStyle(variable!).color).toBe(normalizeColor(theme.components.codeEditor.variable));

    editor.destroy();
    editor.dom.remove();
  });

  it.each([
    ['plain', 'title: plain value', 'plain value'],
    ['number', 'count: 3', '3'],
    ['boolean', 'enabled: true', 'true'],
    ['single-quoted', "'title': 'single quoted'", "'single quoted'"],
    ['double-quoted', '"title": "double quoted"', '"double quoted"'],
    ['literal block', 'title: |\n  literal content', 'literal content'],
    ['folded block', 'title: >\n  folded content', 'folded content'],
  ])('uses the string token for read-only YAML %s scalars', async (_name, doc, value) => {
    const theme = createTheme({ colors: { mode } });
    const language = await loadLanguageExtension('yaml');
    const editor = createEditor(theme, doc, [language!, EditorState.readOnly.of(true)]);

    try {
      const valueElement = Array.from(editor.contentDOM.querySelectorAll('span')).find(
        (span) => span.textContent?.trim() === value
      );

      expect(valueElement).toHaveStyle({ color: theme.components.codeEditor.string });
      expect(editor.contentDOM.querySelector('span')).toHaveStyle({ color: theme.components.codeEditor.variable });
    } finally {
      editor.destroy();
      editor.dom.remove();
    }
  });

  it.each(['&a key', '!!str key', '&a !!str key', '!!str &a key'])(
    'keeps the read-only YAML key %s in the foreground color',
    async (key) => {
      const theme = createTheme({ colors: { mode } });
      const language = await loadLanguageExtension('yaml');
      const editor = createEditor(theme, `${key}: value`, [language!, EditorState.readOnly.of(true)]);

      try {
        const spans = Array.from(editor.contentDOM.querySelectorAll('span'));
        const keyElement = spans.find((span) => span.textContent === 'key');
        const valueElement = spans.find((span) => span.textContent === 'value');

        expect(keyElement).toHaveStyle({ color: theme.components.codeEditor.variable });
        expect(valueElement).toHaveStyle({ color: theme.components.codeEditor.string });
      } finally {
        editor.destroy();
        editor.dom.remove();
      }
    }
  );

  it.each(['markdown', 'html', 'xml'] as const)('keeps %s prose in the normal foreground color', async (languageId) => {
    const theme = createTheme({ colors: { mode } });
    const doc = languageId === 'markdown' ? 'plain prose' : '<p>plain prose</p>';
    const language = await loadLanguageExtension(languageId);
    const editor = createEditor(theme, doc, language!);

    try {
      const text = Array.from(editor.contentDOM.querySelector('.cm-line')!.childNodes).find(
        (node) => node.textContent === 'plain prose'
      )!;
      expect(text.nodeType).toBe(Node.TEXT_NODE);
      expect(editor.dom).toHaveStyle({ color: theme.components.input.text });
    } finally {
      editor.destroy();
      editor.dom.remove();
    }
  });

  it('keeps syntax colors above the WCAG AA text contrast threshold', () => {
    const theme = createTheme({ colors: { mode } });
    const syntaxColors = Object.values(theme.components.codeEditor);
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
