import { type CompletionContext } from '@codemirror/autocomplete';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { createTheme, DataLinkBuiltInVars, VariableOrigin, type VariableSuggestion } from '@grafana/data';

import { createDataLinkHighlighter, createDataLinkTheme, dataLinkAutocompletion } from './codemirrorUtils';

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
    it('creates a theme extension for light mode', () => {
      const theme = createTheme({ colors: { mode: 'light' } });
      expect(createDataLinkTheme(theme)).toBeDefined();
    });

    it('creates a theme extension for dark mode', () => {
      const theme = createTheme({ colors: { mode: 'dark' } });
      expect(createDataLinkTheme(theme)).toBeDefined();
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
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('', 0, true));
        expect(result).not.toBeNull();
        expect(result?.options).toHaveLength(4);
        expect(result?.from).toBe(0);
      });

      it('formats series variable correctly (no queryparam)', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('', 0, true));
        const opt = result?.options.find((o) => o.label === '__series.name');
        expect(opt?.apply).toBe('${__series.name}');
      });

      it('formats template variable with queryparam', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('', 0, true));
        const opt = result?.options.find((o) => o.label === 'myVar');
        expect(opt?.apply).toBe('${myVar:queryparam}');
      });

      it('formats includeVars without queryparam', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('', 0, true));
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

      it('replaces the $ when applying (does not duplicate it)', () => {
        // from must point at the `$` so applying `${var}` replaces it rather than
        // producing `$${var}`.
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('url?p=$', 7, false));
        expect(result?.from).toBe(6); // index of `$`
      });

      it('shows completions after ${', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('${', 2, false));
        expect(result).not.toBeNull();
      });

      it('filters by the variable name typed after ${', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('${ser', 5, false));
        expect(result).not.toBeNull();
        expect(result?.options.map((o) => o.label)).toEqual(['__series.name']);
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

      it('preserves the = when applying (from points after =)', () => {
        // The `=` is a separator, not part of the variable. Applying must keep it:
        // `?param=` + `${var}`, never swallowing the `=`.
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('url?param=', 10, false));
        expect(result?.from).toBe(10); // position after `=`, so `=` is not replaced
      });

      it('preserves the = when a filter prefix has been typed (=fo)', () => {
        // Regression: previously `=fo` had from at the `=`, swallowing it on apply.
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('url?param=fo', 12, false));
        expect(result?.from).toBe(10); // after `=`; only the `fo` prefix is replaced
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
});
