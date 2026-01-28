import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { createTheme, DataLinkBuiltInVars, VariableOrigin, VariableSuggestion } from '@grafana/data';

import {
  createDataLinkAutocompletion,
  createDataLinkHighlighter,
  createDataLinkTheme,
  dataLinkAutocompletion,
} from './codemirrorUtils';

// Mock DOM elements required by CodeMirror
beforeAll(() => {
  Range.prototype.getClientRects = jest.fn(() => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: jest.fn(),
  }));
  Range.prototype.getBoundingClientRect = jest.fn(() => ({
    x: 0,
    y: 0,
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    toJSON: () => {},
  }));
});

const mockSuggestions: VariableSuggestion[] = [
  {
    value: DataLinkBuiltInVars.seriesName,
    label: '__series.name',
    documentation: 'Series name',
    origin: VariableOrigin.Series,
  },
  {
    value: DataLinkBuiltInVars.fieldName,
    label: '__field.name',
    documentation: 'Field name',
    origin: VariableOrigin.Field,
  },
  {
    value: 'myVar',
    label: 'myVar',
    documentation: 'Custom variable',
    origin: VariableOrigin.Template,
  },
  {
    value: DataLinkBuiltInVars.includeVars,
    label: '__all_variables',
    documentation: 'Include all variables',
    origin: VariableOrigin.Template,
  },
];

describe('codemirrorUtils', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  /**
   * Helper to create editor with extensions
   */
  function createEditor(text: string, extensions: Extension | Extension[]) {
    const state = EditorState.create({
      doc: text,
      extensions,
    });
    return new EditorView({ state, parent: container });
  }

  describe('createDataLinkTheme', () => {
    it('creates theme for light mode', () => {
      const theme = createTheme({ colors: { mode: 'light' } });
      const themeExtension = createDataLinkTheme(theme);

      expect(themeExtension).toBeDefined();
      expect(Array.isArray(themeExtension)).toBe(true);
    });

    it('creates theme for dark mode', () => {
      const theme = createTheme({ colors: { mode: 'dark' } });
      const themeExtension = createDataLinkTheme(theme);

      expect(themeExtension).toBeDefined();
      expect(Array.isArray(themeExtension)).toBe(true);
    });

    it('applies theme to editor', () => {
      const theme = createTheme({ colors: { mode: 'light' } });
      const themeExtension = createDataLinkTheme(theme);
      const view = createEditor('${test}', themeExtension);

      expect(view.dom).toBeInstanceOf(HTMLElement);
      view.destroy();
    });

    it('applies theme with variable highlighting', () => {
      const theme = createTheme({ colors: { mode: 'dark' } });
      const themeExtension = createDataLinkTheme(theme);
      const highlighter = createDataLinkHighlighter();
      const view = createEditor('${variable}', [themeExtension, highlighter]);

      expect(view.dom).toBeInstanceOf(HTMLElement);
      const content = view.dom.textContent;
      expect(content).toBe('${variable}');
      view.destroy();
    });
  });

  describe('createDataLinkHighlighter', () => {
    it('creates highlighter extension', () => {
      const highlighter = createDataLinkHighlighter();

      expect(highlighter).toBeDefined();
    });

    it('highlights single variable', () => {
      const highlighter = createDataLinkHighlighter();
      const view = createEditor('${variable}', [highlighter]);

      const content = view.dom.textContent;
      expect(content).toBe('${variable}');
      view.destroy();
    });

    it('highlights multiple variables', () => {
      const highlighter = createDataLinkHighlighter();
      const view = createEditor('${var1} and ${var2}', [highlighter]);

      const content = view.dom.textContent;
      expect(content).toBe('${var1} and ${var2}');
      view.destroy();
    });

    it('highlights variables in URLs', () => {
      const highlighter = createDataLinkHighlighter();
      const view = createEditor('https://example.com?id=${id}&name=${name}', [highlighter]);

      const content = view.dom.textContent;
      expect(content).toBe('https://example.com?id=${id}&name=${name}');
      view.destroy();
    });

    it('does not highlight incomplete variables', () => {
      const highlighter = createDataLinkHighlighter();
      const view = createEditor('${incomplete', [highlighter]);

      const content = view.dom.textContent;
      expect(content).toBe('${incomplete');
      view.destroy();
    });

    it('highlights variables with dots', () => {
      const highlighter = createDataLinkHighlighter();
      const view = createEditor('${__series.name}', [highlighter]);

      const content = view.dom.textContent;
      expect(content).toBe('${__series.name}');
      view.destroy();
    });

    it('highlights variables with underscores', () => {
      const highlighter = createDataLinkHighlighter();
      const view = createEditor('${__field_name}', [highlighter]);

      const content = view.dom.textContent;
      expect(content).toBe('${__field_name}');
      view.destroy();
    });

    it('updates highlights when document changes', () => {
      const highlighter = createDataLinkHighlighter();
      const view = createEditor('initial', [highlighter]);

      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: '${newVar}' },
      });

      const content = view.dom.textContent;
      expect(content).toBe('${newVar}');
      view.destroy();
    });
  });

  describe('dataLinkAutocompletion', () => {
    /**
     * Helper to create a mock completion context
     */
    function createMockContext(
      text: string,
      pos: number,
      explicit = false
    ): CompletionContext {
      const state = EditorState.create({ doc: text });
      return {
        state,
        pos,
        explicit,
        matchBefore: (regex: RegExp) => {
          const before = text.slice(0, pos);
          const match = before.match(regex);
          if (!match) {
            return null;
          }
          const from = pos - match[0].length;
          return {
            from,
            to: pos,
            text: match[0],
          };
        },
        aborted: false,
        addEventListener: jest.fn(),
      } as unknown as CompletionContext;
    }

    describe('explicit completion', () => {
      it('shows all suggestions on explicit trigger', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('', 0, true);

        const result = autocomplete(context);

        expect(result).not.toBeNull();
        expect(result?.options).toHaveLength(4);
        expect(result?.from).toBe(0);
      });

      it('formats series variable correctly', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('', 0, true);

        const result = autocomplete(context);

        const seriesOption = result?.options.find((opt) => opt.label === '__series.name');
        expect(seriesOption).toBeDefined();
        expect(seriesOption?.apply).toBe('${__series.name}');
      });

      it('formats field variable correctly', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('', 0, true);

        const result = autocomplete(context);

        const fieldOption = result?.options.find((opt) => opt.label === '__field.name');
        expect(fieldOption).toBeDefined();
        expect(fieldOption?.apply).toBe('${__field.name}');
      });

      it('formats template variable with queryparam', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('', 0, true);

        const result = autocomplete(context);

        const templateOption = result?.options.find((opt) => opt.label === 'myVar');
        expect(templateOption).toBeDefined();
        expect(templateOption?.apply).toBe('${myVar:queryparam}');
      });

      it('formats includeVars without queryparam', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('', 0, true);

        const result = autocomplete(context);

        const includeVarsOption = result?.options.find((opt) => opt.label === '__all_variables');
        expect(includeVarsOption).toBeDefined();
        expect(includeVarsOption?.apply).toBe('${__all_variables}');
      });

      it('returns null when no suggestions available', () => {
        const autocomplete = dataLinkAutocompletion([]);
        const context = createMockContext('', 0, true);

        const result = autocomplete(context);

        expect(result).toBeNull();
      });
    });

    describe('trigger on $ character', () => {
      it('shows completions after typing $', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('$', 1, false);

        const result = autocomplete(context);

        expect(result).not.toBeNull();
        expect(result?.options).toHaveLength(4);
      });

      it('shows completions after typing ${', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('${', 2, false);

        const result = autocomplete(context);

        expect(result).not.toBeNull();
        expect(result?.options).toHaveLength(4);
      });

      it('shows completions while typing variable name', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('${ser', 5, false);

        const result = autocomplete(context);

        expect(result).not.toBeNull();
        expect(result?.options).toHaveLength(4);
      });

      it('does not show completions without trigger', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('test', 4, false);

        const result = autocomplete(context);

        expect(result).toBeNull();
      });
    });

    describe('trigger on = character', () => {
      it('shows completions after typing =', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('url?param=', 10, false);

        const result = autocomplete(context);

        expect(result).not.toBeNull();
        expect(result?.options).toHaveLength(4);
      });

      it('shows completions after typing =${', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('url?param=${', 12, false);

        const result = autocomplete(context);

        expect(result).not.toBeNull();
        expect(result?.options).toHaveLength(4);
      });
    });

    describe('option metadata', () => {
      it('includes label for all options', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('$', 1, false);

        const result = autocomplete(context);

        result?.options.forEach((option) => {
          expect(option.label).toBeDefined();
          expect(typeof option.label).toBe('string');
        });
      });

      it('includes detail (origin) for all options', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('$', 1, false);

        const result = autocomplete(context);

        result?.options.forEach((option) => {
          expect(option.detail).toBeDefined();
        });
      });

      it('includes documentation info for all options', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('$', 1, false);

        const result = autocomplete(context);

        result?.options.forEach((option) => {
          expect(option.info).toBeDefined();
          expect(typeof option.info).toBe('string');
        });
      });

      it('sets type to variable for all options', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const context = createMockContext('$', 1, false);

        const result = autocomplete(context);

        result?.options.forEach((option) => {
          expect(option.type).toBe('variable');
        });
      });
    });
  });

  describe('createDataLinkAutocompletion', () => {
    it('creates autocompletion extension', () => {
      const extension = createDataLinkAutocompletion(mockSuggestions);

      expect(extension).toBeDefined();
    });

    it('applies autocompletion to editor', () => {
      const extension = createDataLinkAutocompletion(mockSuggestions);
      const view = createEditor('', [extension]);

      expect(view.dom).toBeInstanceOf(HTMLElement);
      view.destroy();
    });

    it('works with empty suggestions', () => {
      const extension = createDataLinkAutocompletion([]);
      const view = createEditor('', [extension]);

      expect(view.dom).toBeInstanceOf(HTMLElement);
      view.destroy();
    });

    it('integrates with theme and highlighter', () => {
      const theme = createTheme({ colors: { mode: 'light' } });
      const themeExtension = createDataLinkTheme(theme);
      const highlighter = createDataLinkHighlighter();
      const autocompletion = createDataLinkAutocompletion(mockSuggestions);

      const view = createEditor('${test}', [themeExtension, highlighter, autocompletion]);

      expect(view.dom).toBeInstanceOf(HTMLElement);
      const content = view.dom.textContent;
      expect(content).toBe('${test}');
      view.destroy();
    });
  });

  describe('integration tests', () => {
    it('combines all utilities together', () => {
      const theme = createTheme({ colors: { mode: 'dark' } });
      const themeExtension = createDataLinkTheme(theme);
      const highlighter = createDataLinkHighlighter();
      const autocompletion = createDataLinkAutocompletion(mockSuggestions);

      const view = createEditor(
        'https://example.com?id=${id}&name=${name}',
        [themeExtension, highlighter, autocompletion]
      );

      expect(view.dom).toBeInstanceOf(HTMLElement);
      const content = view.dom.textContent;
      expect(content).toBe('https://example.com?id=${id}&name=${name}');
      view.destroy();
    });

    it('handles dynamic content updates', () => {
      const theme = createTheme({ colors: { mode: 'light' } });
      const themeExtension = createDataLinkTheme(theme);
      const highlighter = createDataLinkHighlighter();

      const view = createEditor('initial', [themeExtension, highlighter]);

      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: '${variable} updated' },
      });

      const content = view.dom.textContent;
      expect(content).toBe('${variable} updated');
      view.destroy();
    });
  });
});
