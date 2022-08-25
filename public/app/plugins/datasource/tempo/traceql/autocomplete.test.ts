import { DataSourceInstanceSettings, PluginType } from '@grafana/data/src';
import { monacoTypes } from '@grafana/ui';

import { TempoDatasource, TempoJsonData } from '../datasource';
import TempoLanguageProvider from '../language_provider';

import { CompletionProvider } from './autocomplete';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

describe('CompletionProvider', () => {
  it('suggests tags', async () => {
    const { provider, model } = setup('{}', 1, defaultTags);
    const result = await provider.provideCompletionItems(model as any, {} as any);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'foo', insertText: 'foo' }),
      expect.objectContaining({ label: 'bar', insertText: 'bar' }),
    ]);
  });

  it('suggests tag names with quotes', async () => {
    const { provider, model } = setup('{foo=}', 6, defaultTags);

    jest.spyOn(provider.languageProvider, 'getOptions').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolve([
            {
              value: 'foobar',
              label: 'foobar',
            },
          ]);
        })
    );

    const result = await provider.provideCompletionItems(model as any, {} as any);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'foobar', insertText: '"foobar"' }),
    ]);
  });

  it('suggests tag names without quotes', async () => {
    const { provider, model } = setup('{foo="}', 7, defaultTags);

    jest.spyOn(provider.languageProvider, 'getOptions').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolve([
            {
              value: 'foobar',
              label: 'foobar',
            },
          ]);
        })
    );

    const result = await provider.provideCompletionItems(model as any, {} as any);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'foobar', insertText: 'foobar' }),
    ]);
  });

  it('suggests nothing without tags', async () => {
    const { provider, model } = setup('{foo="}', 7, []);
    const result = await provider.provideCompletionItems(model as any, {} as any);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([]);
  });

  it('suggests tags on empty input', async () => {
    const { provider, model } = setup('', 0, defaultTags);
    const result = await provider.provideCompletionItems(model as any, {} as any);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'foo', insertText: '{foo="' }),
      expect.objectContaining({ label: 'bar', insertText: '{bar="' }),
    ]);
  });
});

const defaultTags = ['foo', 'bar'];

function setup(value: string, offset: number, tags?: string[]) {
  const ds = new TempoDatasource(defaultSettings);
  const provider = new CompletionProvider({ languageProvider: new TempoLanguageProvider(ds) });
  if (tags) {
    provider.setTags(tags);
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
  } as any;
  provider.editor = {
    getModel() {
      return model;
    },
  } as any;

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
  };
}

const defaultSettings: DataSourceInstanceSettings<TempoJsonData> = {
  id: 0,
  uid: 'gdev-tempo',
  type: 'tracing',
  name: 'tempo',
  access: 'proxy',
  meta: {
    id: 'tempo',
    name: 'tempo',
    type: PluginType.datasource,
    info: {} as any,
    module: '',
    baseUrl: '',
  },
  jsonData: {
    nodeGraph: {
      enabled: true,
    },
  },
};
