import { monacoTypes, Monaco } from '@grafana/ui';

import { SeriesMessage } from '../types';

import { CompletionProvider } from './autocomplete';

describe('CompletionProvider', () => {
  it('suggests labels', () => {
    const { provider, model } = setup('{}', 1, defaultLabels);
    const result = provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'foo', insertText: 'foo' }),
    ]);
  });

  it('suggests label names with quotes', () => {
    const { provider, model } = setup('{foo=}', 6, defaultLabels);
    const result = provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'bar', insertText: '"bar"' }),
    ]);
  });

  it('suggests label names without quotes', () => {
    const { provider, model } = setup('{foo="}', 7, defaultLabels);
    const result = provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'bar', insertText: 'bar' }),
    ]);
  });

  it('suggests nothing without labels', () => {
    const { provider, model } = setup('{foo="}', 7, []);
    const result = provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([]);
  });

  it('suggests labels on empty input', () => {
    const { provider, model } = setup('', 0, defaultLabels);
    const result = provider.provideCompletionItems(model, {} as monacoTypes.Position);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'foo', insertText: '{foo="' }),
    ]);
  });
});

const defaultLabels = [{ labels: [{ name: 'foo', value: 'bar' }] }];

function setup(value: string, offset: number, series?: SeriesMessage) {
  const provider = new CompletionProvider();
  if (series) {
    provider.setSeries(series);
  }
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
