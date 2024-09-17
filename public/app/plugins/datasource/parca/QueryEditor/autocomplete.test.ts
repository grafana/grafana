import { editor } from 'monaco-editor';

import { Monaco, monacoTypes } from '@grafana/ui';

import { CompletionProvider } from './autocomplete';

import IEditorModel = editor.IEditorModel;

describe('CompletionProvider', () => {
  it('suggests labels', async () => {
    const { provider, model } = await setup('{}', 1, defaultLabels);
    const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'foo', insertText: 'foo' }),
    ]);
  });

  it('suggests label names with quotes', async () => {
    const { provider, model } = await setup('{foo=}', 6, defaultLabels);
    const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'bar', insertText: '"bar"' }),
    ]);
  });

  it('suggests label names without quotes', async () => {
    const { provider, model } = await setup('{foo="}', 7, defaultLabels);
    const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'bar', insertText: 'bar' }),
    ]);
  });

  it('suggests nothing without labels', async () => {
    const { provider, model } = await setup('{foo="}', 7, {});
    const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([]);
  });

  it('suggests labels on empty input', async () => {
    const { provider, model } = await setup('', 0, defaultLabels);
    const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'foo', insertText: '{foo="' }),
    ]);
  });
});

const defaultLabels = { foo: ['bar'] };

const fakeMonaco = {
  Range: {
    fromPositions() {
      return null;
    },
  },
  languages: {
    CompletionItemKind: {
      Enum: 1,
      EnumMember: 2,
    },
  },
} as unknown as Monaco;

function makeFakeEditor(model: IEditorModel) {
  return {
    getModel(): IEditorModel | null {
      return model;
    },
  } as unknown as monacoTypes.editor.IStandaloneCodeEditor;
}

async function setup(value: string, offset: number, labels: { [label: string]: string[] }) {
  const model = makeModel(value, offset);
  const editor = makeFakeEditor(model);

  const provider = new CompletionProvider(
    {
      getLabelNames() {
        return Promise.resolve(Object.keys(labels));
      },
      getLabelValues(label: string) {
        return Promise.resolve(labels[label]);
      },
    },
    fakeMonaco,
    editor
  );
  await provider.init();

  return { provider, model };
}

function makeModel(value: string, offset: number): monacoTypes.editor.ITextModel {
  return {
    id: 'test_monaco',
    getWordAtPosition() {
      return null;
    },
    getOffsetAt() {
      return offset;
    },
    getValue() {
      return value;
    },
  } as unknown as monacoTypes.editor.ITextModel;
}
