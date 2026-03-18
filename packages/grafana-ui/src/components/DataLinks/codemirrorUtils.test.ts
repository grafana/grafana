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

  function createEditor(text: string, extensions: Extension | Extension[]) {
    const state = EditorState.create({ doc: text, extensions });
    return new EditorView({ state, parent: container });
  }

  function createMockContext(text: string, pos: number, explicit = false): CompletionContext {
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
        return { from, to: pos, text: match[0] };
      },
      aborted: false,
      addEventListener: jest.fn(),
    } as unknown as CompletionContext;
  }

  describe('createDataLinkTheme', () => {
    it('creates theme for light mode as an array', () => {
      const theme = createTheme({ colors: { mode: 'light' } });
      const ext = createDataLinkTheme(theme);
      expect(ext).toBeDefined();
      expect(Array.isArray(ext)).toBe(true);
    });

    it('creates theme for dark mode', () => {
      const theme = createTheme({ colors: { mode: 'dark' } });
      const ext = createDataLinkTheme(theme);
      expect(ext).toBeDefined();
    });

    it('applies theme with variable highlighting', () => {
      const theme = createTheme({ colors: { mode: 'light' } });
      const view = createEditor('${variable}', [createDataLinkTheme(theme), createDataLinkHighlighter()]);
      expect(view.dom).toHaveTextContent('${variable}');
      view.destroy();
    });
  });

  describe('createDataLinkHighlighter', () => {
    it('creates highlighter extension', () => {
      expect(createDataLinkHighlighter()).toBeDefined();
    });

    it('highlights single variable', () => {
      const view = createEditor('${variable}', [createDataLinkHighlighter()]);
      expect(view.dom).toHaveTextContent('${variable}');
      view.destroy();
    });

    it('highlights multiple variables', () => {
      const view = createEditor('${var1} and ${var2}', [createDataLinkHighlighter()]);
      expect(view.dom).toHaveTextContent('${var1} and ${var2}');
      view.destroy();
    });

    it('highlights variables in URLs', () => {
      const view = createEditor('https://example.com?id=${id}&name=${name}', [createDataLinkHighlighter()]);
      expect(view.dom).toHaveTextContent('https://example.com?id=${id}&name=${name}');
      view.destroy();
    });

    it('does not highlight incomplete variables', () => {
      const view = createEditor('${incomplete', [createDataLinkHighlighter()]);
      expect(view.state.doc.toString()).toBe('${incomplete');
      view.destroy();
    });

    it('updates highlights when document changes', () => {
      const view = createEditor('initial', [createDataLinkHighlighter()]);
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '${newVar}' } });
      expect(view.dom).toHaveTextContent('${newVar}');
      view.destroy();
    });
  });

  describe('dataLinkAutocompletion', () => {
    describe('explicit completion', () => {
      it('shows all suggestions on explicit trigger', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const result = autocomplete(createMockContext('', 0, true));
        expect(result).not.toBeNull();
        expect(result?.options).toHaveLength(4);
        expect(result?.from).toBe(0);
      });

      it('formats series variable correctly (no queryparam)', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const result = autocomplete(createMockContext('', 0, true));
        const opt = result?.options.find((o) => o.label === '__series.name');
        expect(opt?.apply).toBe('${__series.name}');
      });

      it('formats template variable with queryparam', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const result = autocomplete(createMockContext('', 0, true));
        const opt = result?.options.find((o) => o.label === 'myVar');
        expect(opt?.apply).toBe('${myVar:queryparam}');
      });

      it('formats includeVars without queryparam', () => {
        const autocomplete = dataLinkAutocompletion(mockSuggestions);
        const result = autocomplete(createMockContext('', 0, true));
        const opt = result?.options.find((o) => o.label === '__all_variables');
        expect(opt?.apply).toBe('${__all_variables}');
      });

      it('returns null when no suggestions', () => {
        expect(dataLinkAutocompletion([])(createMockContext('', 0, true))).toBeNull();
      });
    });

    describe('trigger on $ character', () => {
      it('shows completions after $', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('$', 1, false));
        expect(result).not.toBeNull();
        expect(result?.options).toHaveLength(4);
      });

      it('shows completions after ${', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('${', 2, false));
        expect(result).not.toBeNull();
      });

      it('shows completions while typing variable name', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('${ser', 5, false));
        expect(result).not.toBeNull();
      });

      it('does not show completions without trigger', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('test', 4, false));
        expect(result).toBeNull();
      });
    });

    describe('trigger on = character', () => {
      it('shows completions after =', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('url?param=', 10, false));
        expect(result).not.toBeNull();
        expect(result?.options).toHaveLength(4);
      });

      it('shows completions after =${', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('url?param=${', 12, false));
        expect(result).not.toBeNull();
      });
    });

    describe('option metadata', () => {
      it('includes detail (origin) for all options', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('$', 1, false));
        result?.options.forEach((opt) => expect(opt.detail).toBeDefined());
      });

      it('includes documentation info for all options', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('$', 1, false));
        result?.options.forEach((opt) => {
          expect(opt.info).toBeDefined();
          expect(typeof opt.info).toBe('string');
        });
      });

      it('sets type to variable for all options', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('$', 1, false));
        result?.options.forEach((opt) => expect(opt.type).toBe('variable'));
      });
    });
  });

  describe('createDataLinkAutocompletion', () => {
    it('creates autocompletion extension', () => {
      expect(createDataLinkAutocompletion(mockSuggestions)).toBeDefined();
    });

    it('applies to an editor without errors', () => {
      const view = createEditor('', [createDataLinkAutocompletion(mockSuggestions)]);
      expect(view.dom).toBeInstanceOf(HTMLElement);
      view.destroy();
    });

    it('works with empty suggestions', () => {
      const view = createEditor('', [createDataLinkAutocompletion([])]);
      expect(view.dom).toBeInstanceOf(HTMLElement);
      view.destroy();
    });

    it('integrates theme + highlighter + autocompletion', () => {
      const theme = createTheme({ colors: { mode: 'light' } });
      const view = createEditor('${test}', [
        createDataLinkTheme(theme),
        createDataLinkHighlighter(),
        createDataLinkAutocompletion(mockSuggestions),
      ]);
      expect(view.dom).toHaveTextContent('${test}');
      view.destroy();
    });
  });
});
