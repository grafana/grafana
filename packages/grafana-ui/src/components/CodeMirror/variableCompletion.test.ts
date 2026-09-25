import { CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { DataLinkBuiltInVars, VariableOrigin, type VariableSuggestion } from '@grafana/data';

import { applyVariableReference, createVariableCompletionSource } from './variableCompletion';

const suggestions: VariableSuggestion[] = [
  { value: 'myVar', label: 'myVar', documentation: 'Custom variable', origin: VariableOrigin.Template },
  { value: DataLinkBuiltInVars.fieldName, label: '__field.name', origin: VariableOrigin.Field },
  { value: '__data.fields["Value"]', label: 'Value', origin: VariableOrigin.Fields },
];

type VariableSourceOptions = Parameters<typeof createVariableCompletionSource>[1];

const URL_MODE: VariableSourceOptions = {
  separators: ['='],
  getInsertText: (s) => `\${${s.value}:queryparam}`,
};

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

/** `docWithCursor` marks the cursor with `|`; without one it sits at the end. */
function parse(docWithCursor: string) {
  const cursor = docWithCursor.indexOf('|');
  const doc = docWithCursor.replace('|', '');
  return { doc, pos: cursor === -1 ? doc.length : cursor };
}

function complete(docWithCursor: string, options?: VariableSourceOptions) {
  const { doc, pos } = parse(docWithCursor);
  const source = createVariableCompletionSource(suggestions, options);
  return source(new CompletionContext(EditorState.create({ doc }), pos, false));
}

function completeExplicit(docWithCursor: string, options?: VariableSourceOptions) {
  const { doc, pos } = parse(docWithCursor);
  const source = createVariableCompletionSource(suggestions, options);
  return source(new CompletionContext(EditorState.create({ doc }), pos, true));
}

/** Runs an option's `apply` against a real editor and returns the resulting document. */
function applyOption(docWithCursor: string, result: CompletionResult, label: string): string {
  const { doc, pos } = parse(docWithCursor);
  const view = new EditorView({ state: EditorState.create({ doc }), parent: container });
  const option = result.options.find((o) => o.label === label);
  if (!option || typeof option.apply !== 'function') {
    throw new Error(`no applicable option labelled ${label}`);
  }

  option.apply(view, option, result.from, result.to ?? pos);
  const next = view.state.doc.toString();
  view.destroy();
  return next;
}

/** Accepts the first option of an implicitly triggered completion. */
function completeAndApply(docWithCursor: string, label: string, options?: VariableSourceOptions): string {
  const result = complete(docWithCursor, options);
  if (!result) {
    throw new Error(`no completion offered for ${docWithCursor}`);
  }
  return applyOption(docWithCursor, result, label);
}

describe('createVariableCompletionSource', () => {
  describe('triggering', () => {
    it('offers every variable once `$` is typed', () => {
      const result = complete('# Title\n$');
      expect(result?.from).toBe(8);
      expect(result?.options.map((o) => o.label)).toEqual(['myVar', '__field.name', 'Value']);
    });

    it('replaces the whole reference being typed, including the brace', () => {
      expect(complete('${myV')?.from).toBe(0);
      expect(complete('${myV')?.options.map((o) => o.label)).toEqual(['myVar']);
    });

    it('matches on the suggestion value as well as the label', () => {
      // `__data.fields["Value"]` is the value; `Value` is the label.
      expect(complete('$__data')?.options.map((o) => o.label)).toEqual(['Value']);
      expect(complete('$Value')?.options.map((o) => o.label)).toEqual(['Value']);
    });

    it('stays closed outside a reference', () => {
      expect(complete('some text')).toBeNull();
    });

    it('shows everything on an explicit request outside a reference, inserting at the cursor', () => {
      const result = completeExplicit('some text ');
      expect(result?.from).toBe(10);
      expect(result?.options).toHaveLength(3);
    });

    it('shows everything on an explicit request after a trigger, still anchored at the `$`', () => {
      const result = completeExplicit('$myV');
      expect(result?.from).toBe(0);
      expect(result?.options).toHaveLength(3);
    });

    it('offers nothing at all when there are no suggestions', () => {
      const source = createVariableCompletionSource([]);
      expect(source(new CompletionContext(EditorState.create({ doc: '$' }), 1, true))).toBeNull();
    });
  });

  describe('option metadata', () => {
    it('defaults to the suggestion label with its origin as the detail', () => {
      const options = complete('$')?.options ?? [];
      expect(options[0]).toMatchObject({ label: 'myVar', detail: VariableOrigin.Template, type: 'variable' });
      expect(options[0].info).toBe('Custom variable');
    });

    it('takes label and detail from `toDisplay` when given', () => {
      const options =
        complete('$', {
          toDisplay: (s) => ({
            label: `\${${s.value}}`,
            detail: s.value === s.label ? s.origin : `${s.label} / ${s.origin}`,
          }),
        })?.options ?? [];

      expect(options[0]).toMatchObject({ label: '${myVar}', detail: VariableOrigin.Template });
      expect(options[2]).toMatchObject({
        label: '${__data.fields["Value"]}',
        detail: `Value / ${VariableOrigin.Fields}`,
      });
    });
  });

  describe('separators', () => {
    it('does not trigger on a separator that was not configured', () => {
      expect(complete('url?param=')).toBeNull();
    });

    it('opens after a configured separator and preserves it', () => {
      const result = complete('url?param=', URL_MODE);
      expect(result?.from).toBe(10);
      expect(applyOption('url?param=', result!, 'myVar')).toBe('url?param=${myVar:queryparam}');
    });

    it('preserves the separator once a filter prefix has been typed', () => {
      const result = complete('url?param=myV', URL_MODE);
      expect(result?.from).toBe(10);
      expect(applyOption('url?param=myV', result!, 'myVar')).toBe('url?param=${myVar:queryparam}');
    });

    it('still anchors at the `$` when one is typed after the separator', () => {
      // The end-anchored match lands on the `$`, never on the `=`.
      const result = complete('url?param=$myV', URL_MODE);
      expect(result?.from).toBe(10);
      expect(applyOption('url?param=$myV', result!, 'myVar')).toBe('url?param=${myVar:queryparam}');
    });
  });

  describe('getInsertText', () => {
    it('inserts a plain `${value}` by default', () => {
      expect(completeAndApply('$myV', 'myVar')).toBe('${myVar}');
    });

    it('inserts whatever `getInsertText` returns', () => {
      expect(completeAndApply('$myV', 'myVar', URL_MODE)).toBe('${myVar:queryparam}');
    });
  });
});

describe('applying an option next to a closing brace', () => {
  it('consumes the brace `closeBrackets` inserted, rather than doubling it', () => {
    // Typing `${` in an editor with bracket closing leaves the document as `${|}`.
    expect(completeAndApply('${|}', 'myVar')).toBe('${myVar}');
  });

  it('replaces the whole reference when the cursor sits inside a complete one', () => {
    expect(completeAndApply('?x=${my|Var} tail', 'myVar')).toBe('?x=${myVar} tail');
  });

  it('replaces a reference that carries a format suffix', () => {
    expect(completeAndApply('?x=${my|Var:queryparam}', 'myVar', URL_MODE)).toBe('?x=${myVar:queryparam}');
  });

  it('leaves a closing brace alone when the reference being typed has no opening one', () => {
    // The `}` belongs to something else — the option brings its own pair.
    expect(completeAndApply('?x=$my|} tail', 'myVar')).toBe('?x=${myVar}} tail');
  });

  it('leaves a closing brace alone after a separator', () => {
    expect(completeAndApply('url?param=my|} tail', 'myVar', URL_MODE)).toBe('url?param=${myVar:queryparam}} tail');
  });

  it('does not reach a closing brace on a later line', () => {
    expect(completeAndApply('${my|\nbar}', 'myVar')).toBe('${myVar}\nbar}');
  });

  it('does not reach past the end of an unclosed reference', () => {
    expect(completeAndApply('?x=${my|', 'myVar')).toBe('?x=${myVar}');
  });

  it('inserts without consuming anything on an explicit request outside a reference', () => {
    const result = completeExplicit('?x=| tail');
    expect(applyOption('?x=| tail', result!, 'myVar')).toBe('?x=${myVar} tail');
  });

  // Known gap: the tail of a bracketed accessor is not a name, so it is left
  // behind. Widening the pattern enough to cover it would also swallow prose in
  // a Markdown document, so this is deliberate.
  it('leaves a bracketed accessor tail behind', () => {
    expect(completeAndApply('?x=${__data.fi|elds["Value"]}', 'Value')).toBe(
      '?x=${__data.fields["Value"]}elds["Value"]}'
    );
  });
});

describe('applyVariableReference', () => {
  it('is usable on its own, for a source mixing variables with other option kinds', () => {
    const view = new EditorView({ state: EditorState.create({ doc: '?x=${my}' }), parent: container });

    applyVariableReference('${myVar}')(view, { label: 'myVar' }, 3, 6);

    expect(view.state.doc.toString()).toBe('?x=${myVar}');
    view.destroy();
  });
});
