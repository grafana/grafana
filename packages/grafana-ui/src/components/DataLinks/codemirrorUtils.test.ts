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

  // The text content of every `.cm-variable` decoration the highlighter rendered.
  function highlightedTokens(view: EditorView): string[] {
    return Array.from(view.dom.querySelectorAll('.cm-variable')).map((el) => el.textContent ?? '');
  }

  describe('createDataLinkTheme', () => {
    it('colors the variable token with the theme success color', () => {
      const theme = createTheme({ colors: { mode: 'light' } });
      const view = createEditor('${variable}', [createDataLinkTheme(theme), createDataLinkHighlighter()]);
      const token = view.dom.querySelector('.cm-variable');
      expect(token).not.toBeNull();
      // The theme rule targets `.cm-variable`; assert it actually applies a color.
      expect(getComputedStyle(token!).color).not.toBe('');
      view.destroy();
    });
  });

  describe('createDataLinkHighlighter', () => {
    it('decorates a single variable', () => {
      const view = createEditor('${variable}', [createDataLinkHighlighter()]);
      expect(highlightedTokens(view)).toEqual(['${variable}']);
      view.destroy();
    });

    it('decorates each variable when several are present, including in URLs', () => {
      const view = createEditor('https://x.com?id=${id}&name=${name}', [createDataLinkHighlighter()]);
      expect(highlightedTokens(view)).toEqual(['${id}', '${name}']);
      view.destroy();
    });

    it('does not decorate an incomplete variable', () => {
      const view = createEditor('${incomplete', [createDataLinkHighlighter()]);
      expect(highlightedTokens(view)).toEqual([]);
      view.destroy();
    });

    it('updates decorations when the document changes', () => {
      const view = createEditor('initial', [createDataLinkHighlighter()]);
      expect(highlightedTokens(view)).toEqual([]);
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '${newVar}' } });
      expect(highlightedTokens(view)).toEqual(['${newVar}']);
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

      it('anchors at a typed $ so an explicit request does not produce `$${...}`', () => {
        // Ctrl+Space with a `$` already typed must replace the `$`, not insert
        // after it. `from` at the `$` means applying `${var}` yields `${var}`.
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('url?p=$', 7, true));
        expect(result?.from).toBe(6); // index of `$`
      });

      it('preserves a typed = on an explicit request (from points after =)', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('url?param=', 10, true));
        expect(result?.from).toBe(10); // after `=`, so the separator is not replaced
      });

      it('still shows every suggestion on an explicit request after a trigger', () => {
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext('$ser', 4, true));
        expect(result?.options).toHaveLength(4); // explicit ignores the typed filter
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
