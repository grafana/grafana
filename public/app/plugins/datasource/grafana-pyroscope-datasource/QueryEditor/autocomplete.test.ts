import { monacoTypes, Monaco } from '@grafana/ui';

import { CompletionProvider } from './autocomplete';

describe('CompletionProvider', () => {
  it('suggests labels', async () => {
    const { provider, model } = setup('{}', 1, defaultLabels);
    const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'foo', insertText: 'foo' }),
    ]);
  });

  it('suggests label names with quotes', async () => {
    const { provider, model } = setup('{foo=}', 6, defaultLabels);
    const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'bar', insertText: '"bar"' }),
    ]);
  });

  it('suggests label names without quotes', async () => {
    const { provider, model } = setup('{foo="}', 7, defaultLabels);
    const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'bar', insertText: 'bar' }),
    ]);
  });

  it('suggests nothing without labels', async () => {
    const { provider, model } = setup('{foo="}', 7, []);
    const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([]);
  });

  it('suggests labels on empty input', async () => {
    const { provider, model } = setup('', 0, defaultLabels);
    const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'foo', insertText: '{foo="' }),
    ]);
  });
});

const defaultLabels = ['foo'];

function setup(value: string, offset: number, labels: string[] = []) {
  const provider = new CompletionProvider();
  provider.init(labels, (label) => {
    if (labels.length === 0) {
      return Promise.resolve([]);
    }
    const val = { foo: 'bar' }[label];
    const result = [];
    if (val) {
      result.push(val);
    }
    return Promise.resolve(result);
  });
  const model = makeModel(value, offset);
  provider.monaco = {
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
  provider.editor = {
    getModel() {
      return model;
    },
  } as monacoTypes.editor.IStandaloneCodeEditor;

  return { provider, model };
}

function makeModel(value: string, offset: number) {
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
