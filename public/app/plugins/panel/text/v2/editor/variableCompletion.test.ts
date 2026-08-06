import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';

import { VariableOrigin, type VariableSuggestion } from '@grafana/data';

import { variableCompletion } from './variableCompletion';

const suggestions: VariableSuggestion[] = [
  { value: 'myVar', label: 'myVar', documentation: 'Custom variable', origin: VariableOrigin.Template },
  { value: '__field.name', label: '__field.name', origin: VariableOrigin.Field },
  { value: '__data.fields["Value"]', label: 'Value', origin: VariableOrigin.Fields },
];

function complete(doc: string, explicit = false) {
  const source = variableCompletion(suggestions);
  const context = new CompletionContext(EditorState.create({ doc }), doc.length, explicit);
  return source(context);
}

describe('variableCompletion', () => {
  it('offers every variable once `$` is typed', () => {
    const result = complete('# Title\n$');
    expect(result?.from).toBe(8);
    expect(result?.options.map((o) => o.label)).toEqual(['${myVar}', '${__field.name}', '${__data.fields["Value"]}']);
  });

  it('replaces the whole reference being typed, including the brace', () => {
    const result = complete('${myV');
    expect(result?.from).toBe(0);
    expect(result?.options.map((o) => o.label)).toEqual(['${myVar}']);
  });

  it('matches on the suggestion label as well as the value', () => {
    expect(complete('$Value')?.options.map((o) => o.label)).toEqual(['${__data.fields["Value"]}']);
  });

  it('describes the origin, and the label when it differs from the value', () => {
    const options = complete('$')?.options ?? [];
    expect(options[0]).toMatchObject({ detail: VariableOrigin.Template, info: 'Custom variable' });
    expect(options[2]).toMatchObject({ detail: `Value / ${VariableOrigin.Fields}` });
  });

  it('stays closed outside a variable reference, even when explicitly requested', () => {
    expect(complete('some text')).toBeNull();
    expect(complete('some text ', true)).toBeNull();
  });
});
