import { CompletionContext, type CompletionSource } from '@codemirror/autocomplete';
import { EditorView } from '@codemirror/view';
import { act, render, screen } from '@testing-library/react';
import { createElement } from 'react';

import { VariableOrigin, type VariableSuggestion } from '@grafana/data';
import { CodeMirrorEditor } from '@grafana/ui';

import { variableCompletionOptions } from './variableCompletion';

const suggestions: VariableSuggestion[] = [
  { value: 'myVar', label: 'myVar', documentation: 'Custom variable', origin: VariableOrigin.Template },
  { value: '__field.name', label: '__field.name', origin: VariableOrigin.Field },
  { value: '__data.fields["Value"]', label: 'Value', origin: VariableOrigin.Fields },
];

/** `docWithCursor` marks the cursor with `|`; without one it sits at the end. */
async function complete(docWithCursor: string, explicit = false) {
  const cursor = docWithCursor.indexOf('|');
  const doc = docWithCursor.replace('|', '');
  const pos = cursor === -1 ? doc.length : cursor;
  render(
    createElement(CodeMirrorEditor, {
      value: doc,
      onChange: jest.fn(),
      extensions: ({ variableCompletion }) => [variableCompletion(suggestions, variableCompletionOptions)],
    })
  );
  const textbox = await screen.findByRole('textbox');
  const view = EditorView.findFromDOM(textbox)!;
  const source = view.state.languageDataAt<CompletionSource>('autocomplete', pos)[0];
  return { view, pos, result: await source(new CompletionContext(view.state, pos, explicit)) };
}

async function completeAndApply(docWithCursor: string, label: string) {
  const { view, pos, result } = await complete(docWithCursor);
  const option = result?.options.find((o) => o.label === label);
  if (!result || !option || typeof option.apply !== 'function') {
    throw new Error(`no applicable option labelled ${label}`);
  }

  const apply = option.apply;
  act(() => apply(view, option, result.from, result.to ?? pos));
  return view.state.doc.toString();
}

// Exercise the configuration through the editor so its display and insertion
// behavior is preserved when the source is constructed behind the lazy boundary.
describe('Text variable completions', () => {
  it('labels options with the reference they insert', async () => {
    const { result } = await complete('# Title\n$');
    expect(result?.from).toBe(8);
    expect(result?.options.map((o) => o.label)).toEqual(['${myVar}', '${__field.name}', '${__data.fields["Value"]}']);
  });

  it('describes the origin, and the label when it differs from the value', async () => {
    const options = (await complete('$')).result?.options ?? [];
    expect(options[0]).toMatchObject({ detail: VariableOrigin.Template, info: 'Custom variable' });
    expect(options[2]).toMatchObject({ detail: `Value / ${VariableOrigin.Fields}` });
  });

  it('inserts the reference it advertises', async () => {
    expect(await completeAndApply('# Title\n$myV', '${myVar}')).toBe('# Title\n${myVar}');
  });

  it('does not double the brace `closeBrackets` inserted', async () => {
    // The editor leaves bracket closing on, so typing `${` gives `${|}`.
    expect(await completeAndApply('${|}', '${myVar}')).toBe('${myVar}');
  });
});
