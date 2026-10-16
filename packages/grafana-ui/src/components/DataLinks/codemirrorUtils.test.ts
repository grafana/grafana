import { CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { createTheme, DataLinkBuiltInVars, VariableOrigin, type VariableSuggestion } from '@grafana/data';

import {
  createDataLinkHighlighter,
  createDataLinkTheme,
  dataLinkAutocompletion,
  type DataLinkInterpolationMode,
} from './codemirrorUtils';

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
    return new CompletionContext(EditorState.create({ doc: text }), pos, explicit);
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

  // Triggering, filtering and option metadata are `createVariableCompletionSource`'s
  // behaviour and are covered by its own tests. What is data-link-specific, and
  // tested here, is which separator and which encoding each mode wires up.
  describe('dataLinkAutocompletion', () => {
    function applyOption(doc: string, pos: number, result: CompletionResult, label: string): string {
      const view = createEditor(doc, []);
      const option = result.options.find((o) => o.label === label);
      if (!option || typeof option.apply !== 'function') {
        throw new Error(`no applicable option labelled ${label}`);
      }

      option.apply(view, option, result.from, result.to ?? pos);
      return view.state.doc.toString();
    }

    function complete(doc: string, mode?: DataLinkInterpolationMode, explicit = false) {
      const source = dataLinkAutocompletion(mockSuggestions, mode ? { mode } : {});
      const result = source(createMockContext(doc, doc.length, explicit));
      if (!result) {
        throw new Error(`no completion offered for ${doc}`);
      }
      return result;
    }

    function completeAndApply(doc: string, label: string, mode?: DataLinkInterpolationMode): string {
      return applyOption(doc, doc.length, complete(doc, mode), label);
    }

    describe("mode: 'url'", () => {
      it('encodes a template variable for a query string', () => {
        expect(completeAndApply('url?p=$myV', 'myVar')).toBe('url?p=${myVar:queryparam}');
      });

      it('leaves built-in variables unencoded', () => {
        expect(completeAndApply('url?p=$ser', '__series.name')).toBe('url?p=${__series.name}');
        expect(completeAndApply('url?p=$all', '__all_variables')).toBe('url?p=${__all_variables}');
      });

      it('opens after the query-param separator and preserves it', () => {
        expect(completeAndApply('url?param=', 'myVar')).toBe('url?param=${myVar:queryparam}');
      });

      it('preserves the separator once a filter prefix has been typed', () => {
        // Regression: `=fo` once had `from` at the `=`, swallowing it on apply.
        expect(completeAndApply('url?param=myV', 'myVar')).toBe('url?param=${myVar:queryparam}');
      });

      it('replaces a reference the cursor sits inside rather than doubling its brace', () => {
        const doc = 'url?p=${myVar:queryparam}';
        const pos = 'url?p=${myV'.length;
        const result = dataLinkAutocompletion(mockSuggestions)(createMockContext(doc, pos));

        expect(applyOption(doc, pos, result!, 'myVar')).toBe('url?p=${myVar:queryparam}');
      });
    });

    describe("mode: 'text'", () => {
      it('does not treat = as a separator', () => {
        expect(dataLinkAutocompletion(mockSuggestions, { mode: 'text' })(createMockContext('param=', 6))).toBeNull();
      });

      it('inserts a plain ${var} with no query encoding', () => {
        expect(completeAndApply('$myV', 'myVar', 'text')).toBe('${myVar}');
        expect(completeAndApply('$ser', '__series.name', 'text')).toBe('${__series.name}');
      });

      it('replaces a reference the cursor sits inside rather than doubling its brace', () => {
        const doc = 'title ${myVar} tail';
        const pos = 'title ${myV'.length;
        const result = dataLinkAutocompletion(mockSuggestions, { mode: 'text' })(createMockContext(doc, pos));

        expect(applyOption(doc, pos, result!, 'myVar')).toBe('title ${myVar} tail');
      });
    });

    it('offers nothing when there are no suggestions', () => {
      expect(dataLinkAutocompletion([])(createMockContext('$', 1, true))).toBeNull();
    });
  });
});
