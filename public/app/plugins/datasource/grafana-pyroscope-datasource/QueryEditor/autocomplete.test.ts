import { type monacoTypes, type Monaco } from '@grafana/ui';

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

  describe('UTF-8 label names', () => {
    const utf8Labels = ['foo', 'k8s.namespace'];

    it('suggests quoted UTF-8 label on empty input', async () => {
      const { provider, model } = setup('', 0, utf8Labels);
      const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
      expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
        expect.objectContaining({ label: 'foo', insertText: '{foo="' }),
        expect.objectContaining({ label: 'k8s.namespace', insertText: '{"k8s.namespace"="' }),
      ]);
    });

    it('suggests quoted UTF-8 label name inside braces', async () => {
      const { provider, model } = setup('{}', 1, utf8Labels);
      const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
      expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
        expect.objectContaining({ label: 'foo', insertText: 'foo' }),
        expect.objectContaining({ label: 'k8s.namespace', insertText: '"k8s.namespace"' }),
      ]);
    });

    it('suggests values for quoted UTF-8 label name', async () => {
      const { provider, model } = setup('{"k8s.namespace"=}', 17, utf8Labels);
      const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
      expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
        expect.objectContaining({ label: 'prod', insertText: '"prod"' }),
      ]);
    });

    it('suggests values for quoted UTF-8 label name between quotes', async () => {
      const { provider, model } = setup('{"k8s.namespace"="}', 18, utf8Labels);
      const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
      expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
        expect.objectContaining({ label: 'prod', insertText: 'prod' }),
      ]);
    });

    it('suggests label names after existing quoted UTF-8 label pair', async () => {
      const { provider, model } = setup('{"k8s.namespace"="prod", }', 25, utf8Labels);
      const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
      expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
        expect.objectContaining({ label: 'foo', insertText: 'foo' }),
        expect.objectContaining({ label: 'k8s.namespace', insertText: '"k8s.namespace"' }),
      ]);
    });
  });

  describe('label names with special characters (escaping)', () => {
    it('escapes double quotes in label name on empty input', async () => {
      const labels = ['has"quote'];
      const { provider, model } = setup('', 0, labels);
      const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
      expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
        expect.objectContaining({ label: 'has"quote', insertText: '{"has\\"quote"="' }),
      ]);
    });

    it('escapes double quotes in label name inside braces', async () => {
      const labels = ['has"quote'];
      const { provider, model } = setup('{}', 1, labels);
      const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
      expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
        expect.objectContaining({ label: 'has"quote', insertText: '"has\\"quote"' }),
      ]);
    });

    it('escapes backslashes in label name on empty input', async () => {
      const labels = ['has\\backslash'];
      const { provider, model } = setup('', 0, labels);
      const result = await provider.provideCompletionItems(model, {} as monacoTypes.Position);
      expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
        expect.objectContaining({ label: 'has\\backslash', insertText: '{"has\\\\backslash"="' }),
      ]);
    });
  });

  describe('existingLabels parsing (regression)', () => {
    it('passes correct label name to getLabelValues when another label exists', async () => {
      const requestedLabels: string[] = [];
      // First setup: cursor is after ", " so we're IN_LABEL_NAME — no getLabelValues call here,
      // but let's verify it works for IN_LABEL_VALUE with an existing pair.
      setup('{foo="bar", }', 12, ['foo', 'baz'], (label) => {
        requestedLabels.push(label);
        return Promise.resolve(['val']);
      });
      const { provider: p2, model: m2 } = setup('{foo="bar",baz=}', 15, ['foo', 'baz'], (label) => {
        requestedLabels.push(label);
        return Promise.resolve(['qux']);
      });
      const result = await p2.provideCompletionItems(m2, {} as monacoTypes.Position);
      expect(requestedLabels).toContain('baz');
      expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
        expect.objectContaining({ label: 'qux', insertText: '"qux"' }),
      ]);
    });
  });
});

const defaultLabels = ['foo'];

function setup(
  value: string,
  offset: number,
  labels: string[] = [],
  getLabelValues?: (label: string) => Promise<string[]>
) {
  const provider = new CompletionProvider();
  provider.init(
    labels,
    getLabelValues ??
      ((label) => {
        if (labels.length === 0) {
          return Promise.resolve([]);
        }
        const valMap: Record<string, string> = { foo: 'bar', 'k8s.namespace': 'prod' };
        const val = valMap[label];
        const result = [];
        if (val) {
          result.push(val);
        }
        return Promise.resolve(result);
      })
  );
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
