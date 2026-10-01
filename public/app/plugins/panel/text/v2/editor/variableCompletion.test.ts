import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { VariableOrigin, type VariableSuggestion } from '@grafana/data';

import { variableCompletion } from './variableCompletion';

const suggestions: VariableSuggestion[] = [
  { value: 'myVar', label: 'myVar', documentation: 'Custom variable', origin: VariableOrigin.Template },
  { value: '__field.name', label: '__field.name', origin: VariableOrigin.Field },
  { value: '__data.fields["Value"]', label: 'Value', origin: VariableOrigin.Fields },
];

/** `docWithCursor` marks the cursor with `|`; without one it sits at the end. */
function complete(docWithCursor: string, explicit = false) {
  const cursor = docWithCursor.indexOf('|');
  const doc = docWithCursor.replace('|', '');
  const pos = cursor === -1 ? doc.length : cursor;
  const source = variableCompletion(suggestions);

  return { doc, pos, result: source(new CompletionContext(EditorState.create({ doc }), pos, explicit)) };
}

function completeAndApply(docWithCursor: string, label: string) {
  const { doc, pos, result } = complete(docWithCursor);
  const option = result?.options.find((o) => o.label === label);
  if (!option || typeof option.apply !== 'function') {
    throw new Error(`no applicable option labelled ${label}`);
  }

  const view = new EditorView({ state: EditorState.create({ doc }) });
  option.apply(view, option, result!.from, result!.to ?? pos);
  const next = view.state.doc.toString();
  view.destroy();
  return next;
}

// Triggering and filtering come from `createVariableCompletionSource` and are
// covered by its tests. This source only customises how options are presented.
describe('variableCompletion', () => {
  it('labels options with the reference they insert', () => {
    const { result } = complete('# Title\n$');
    expect(result?.from).toBe(8);
    expect(result?.options.map((o) => o.label)).toEqual(['${myVar}', '${__field.name}', '${__data.fields["Value"]}']);
  });

  it('describes the origin, and the label when it differs from the value', () => {
    const options = complete('$').result?.options ?? [];
    expect(options[0]).toMatchObject({ detail: VariableOrigin.Template, info: 'Custom variable' });
    expect(options[2]).toMatchObject({ detail: `Value / ${VariableOrigin.Fields}` });
  });

  it('inserts the reference it advertises', () => {
    expect(completeAndApply('# Title\n$myV', '${myVar}')).toBe('# Title\n${myVar}');
  });

  it('does not double the brace `closeBrackets` inserted', () => {
    // The editor leaves bracket closing on, so typing `${` gives `${|}`.
    expect(completeAndApply('${|}', '${myVar}')).toBe('${myVar}');
  });
});
