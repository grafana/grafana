import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';

import { VariableOrigin } from '@grafana/data';

import { reducerCompletion, variableCompletionOptions } from './variableCompletion';

describe('variableCompletionOptions', () => {
  it.each([
    {
      name: 'a template variable',
      suggestion: { value: 'myVar', label: 'myVar', origin: VariableOrigin.Template },
      expected: { label: '${myVar}', detail: VariableOrigin.Template },
    },
    {
      name: 'a field with a display name',
      suggestion: { value: '__data.fields["Value"]', label: 'Value', origin: VariableOrigin.Fields },
      expected: { label: '${__data.fields["Value"]}', detail: `Value / ${VariableOrigin.Fields}` },
    },
  ])('formats $name as a Text variable reference', ({ suggestion, expected }) => {
    expect(variableCompletionOptions.toDisplay?.(suggestion)).toEqual(expected);
  });
});

describe('reducerCompletion', () => {
  function completeReducer(doc: string) {
    return reducerCompletion(new CompletionContext(EditorState.create({ doc }), doc.length, false));
  }

  it('offers reducers after :reduce: in a data macro, replacing only the id', () => {
    const doc = 'CPU ${__data.fields.cpu:reduce:me';
    const result = completeReducer(doc);

    expect(result?.from).toBe(doc.length - 'me'.length);
    expect(result?.options.map((o) => o.label)).toEqual(expect.arrayContaining(['lastNotNull', 'mean', 'max']));
  });

  it('leaves out reducers that return every value rather than one', () => {
    const labels = completeReducer('${__data.fields.cpu:reduce:')?.options.map((o) => o.label);

    expect(labels).not.toContain('allValues');
    expect(labels).not.toContain('uniqueValues');
  });

  it.each([
    ['outside a data macro', '${myVar:reduce:'],
    ['after the macro is closed', '${__data.fields.cpu:reduce:mean} '],
    ['before :reduce:', '${__data.fields.cpu'],
  ])('does not respond %s', (_name, doc) => {
    expect(completeReducer(doc)).toBeNull();
  });
});
