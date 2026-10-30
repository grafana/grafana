import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import { registerGoTemplateAutocomplete } from './autocomplete';

async function complete(docWithCursor: string, explicit = false) {
  const register = jest.spyOn(monaco.languages, 'registerCompletionItemProvider');
  const registration = registerGoTemplateAutocomplete(monaco);
  const provider = register.mock.calls[0][1];
  register.mockRestore();

  const pos = docWithCursor.indexOf('¦');
  const model = monaco.editor.createModel(docWithCursor.replace('¦', ''));
  const cancellation = new monaco.CancellationTokenSource();
  try {
    return await provider.provideCompletionItems(
      model,
      model.getPositionAt(pos),
      explicit
        ? { triggerKind: monaco.languages.CompletionTriggerKind.Invoke }
        : { triggerKind: monaco.languages.CompletionTriggerKind.TriggerCharacter, triggerCharacter: '.' },
      cancellation.token
    );
  } finally {
    model.dispose();
    cancellation.dispose();
    registration.dispose();
  }
}

it('preserves Monaco field and method kinds, label context, documentation, and ranges', async () => {
  const fields = await complete('{{ .¦ }}');
  expect(fields?.suggestions).toContainEqual({
    label: { label: 'Labels', detail: '(Alert)', description: '[]KeyValue' },
    kind: monaco.languages.CompletionItemKind.Field,
    insertText: 'Labels',
    range: { startLineNumber: 1, endLineNumber: 1, startColumn: 5, endColumn: 5 },
    detail: '[]KeyValue',
    documentation: { value: 'A set of labels attached to the alert.' },
  });

  const methods = await complete('{{ .Labels.¦ }}');
  expect(methods?.suggestions).toContainEqual({
    label: { label: 'Remove', description: 'KeyValue[] function(keys []string)' },
    kind: monaco.languages.CompletionItemKind.Method,
    insertText: 'Remove',
    range: { startLineNumber: 1, endLineNumber: 1, startColumn: 12, endColumn: 12 },
    detail: 'KeyValue[] function(keys []string)',
    documentation: undefined,
  });
});

it('preserves Monaco function signatures, documentation, and prefix ranges', async () => {
  const result = await complete('{{ jo¦ }}', true);
  expect(result?.suggestions).toContainEqual({
    label: { label: 'join', description: 'function(separator string, s []string)' },
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: 'join',
    range: { startLineNumber: 1, endLineNumber: 1, startColumn: 4, endColumn: 6 },
    documentation: { value: 'Joins an array of strings using the separator provided.' },
    detail: 'function(separator string, s []string)',
  });
});

it('preserves Monaco snippet text and its insertion range outside actions', async () => {
  const result = await complete('alerts¦', true);
  expect(result?.suggestions).toContainEqual({
    label: { label: 'alertsloop', description: undefined },
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '\n{{ range .Alerts }}\n  Status: {{ .Status }}\n  Starts at: {{ .StartsAt }}\n{{ end }}\n',
    range: { startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 7 },
    documentation: 'Renders a loop through alerts',
    detail: undefined,
  });
});
