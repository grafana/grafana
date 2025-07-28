import { DataSourceInstanceSettings, PluginMetaInfo, PluginType } from '@grafana/data';
import { monacoTypes } from '@grafana/ui';

import { v1Tags, v2Tags, emptyTags, testIntrinsics } from '../SearchTraceQLEditor/mocks';
import { TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { Scope, TempoJsonData } from '../types';

import { CompletionProvider } from './autocomplete';
import { intrinsicsV1, scopes } from './traceql';

const emptyPosition = {} as monacoTypes.Position;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
}));

describe('CompletionProvider', () => {
  it('suggests tags, intrinsics and scopes (API v1)', async () => {
    const { provider, model } = setup('{}', 1, v1Tags);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      ...scopes.map((s) => expect.objectContaining({ label: s, insertText: s })),
      ...intrinsicsV1.map((s) => expect.objectContaining({ label: s, insertText: s })),
      expect.objectContaining({ label: 'bar', insertText: '.bar' }),
      expect.objectContaining({ label: 'foo', insertText: '.foo' }),
      expect.objectContaining({ label: 'status', insertText: '.status' }),
    ]);
  });

  it('suggests tags, intrinsics and scopes (API v2)', async () => {
    const { provider, model } = setup('{}', 1, undefined, v2Tags);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      ...scopes.map((s) => expect.objectContaining({ label: s, insertText: s })),
      ...testIntrinsics.map((s) => expect.objectContaining({ label: s, insertText: s })),
      expect.objectContaining({ label: 'cluster', insertText: '.cluster' }),
      expect.objectContaining({ label: 'container', insertText: '.container' }),
      expect.objectContaining({ label: 'db', insertText: '.db' }),
    ]);
  });

  it('does not wrap the tag value in quotes if the type in the response is something other than "string"', async () => {
    const { provider, model } = setup('{.foo=}', 6, v1Tags);

    jest.spyOn(provider.languageProvider, 'getOptionsV2').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolve([
            {
              type: 'int',
              value: 'foobar',
              label: 'foobar',
            },
          ]);
        })
    );

    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'foobar', insertText: 'foobar' }),
    ]);
  });

  it('wraps the tag value in quotes if the type in the response is set to "string"', async () => {
    const { provider, model } = setup('{.foo=}', 6, v1Tags);

    jest.spyOn(provider.languageProvider, 'getOptionsV2').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolve([
            {
              type: 'string',
              value: 'foobar',
              label: 'foobar',
            },
          ]);
        })
    );

    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'foobar', insertText: '"foobar"' }),
    ]);
  });

  it('inserts the tag value without quotes if the user has entered quotes', async () => {
    const { provider, model } = setup('{.foo="}', 6, v1Tags);

    jest.spyOn(provider.languageProvider, 'getOptionsV2').mockImplementation(
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

    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'foobar', insertText: 'foobar' }),
    ]);
  });

  it('suggests options when inside quotes', async () => {
    const { provider, model } = setup('{.foo=""}', 7, undefined, v2Tags);

    jest.spyOn(provider.languageProvider, 'getOptionsV2').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolve([
            {
              type: 'string',
              value: 'foobar',
              label: 'foobar',
            },
          ]);
        })
    );

    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'foobar', insertText: 'foobar' }),
    ]);
  });

  it('suggests nothing without tags', async () => {
    const { provider, model } = setup('{.foo="}', 8, emptyTags);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([]);
  });

  it('suggests tags on empty input (API v1)', async () => {
    const { provider, model } = setup('', 0, v1Tags);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      ...scopes.map((s) => expect.objectContaining({ label: s, insertText: `{ ${s}$0 }` })),
      ...intrinsicsV1.map((s) => expect.objectContaining({ label: s, insertText: `{ ${s}$0 }` })),
      expect.objectContaining({ label: 'bar', insertText: '{ .bar' }),
      expect.objectContaining({ label: 'foo', insertText: '{ .foo' }),
      expect.objectContaining({ label: 'status', insertText: '{ .status' }),
    ]);
  });

  it('suggests tags on empty input (API v2)', async () => {
    const { provider, model } = setup('', 0, undefined, v2Tags);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      ...scopes.map((s) => expect.objectContaining({ label: s, insertText: `{ ${s}$0 }` })),
      ...testIntrinsics.map((s) => expect.objectContaining({ label: s, insertText: `{ ${s}$0 }` })),
      expect.objectContaining({ label: 'cluster', insertText: '{ .cluster' }),
      expect.objectContaining({ label: 'container', insertText: '{ .container' }),
      expect.objectContaining({ label: 'db', insertText: '{ .db' }),
    ]);
  });

  it('only suggests tags after typing the global attribute scope (API v1)', async () => {
    const { provider, model } = setup('{.}', 2, v1Tags);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual(
      v1Tags.map((s) => expect.objectContaining({ label: s, insertText: s }))
    );
  });

  it('only suggests tags after typing the global attribute scope (API v2)', async () => {
    const { provider, model } = setup('{.}', 2, undefined, v2Tags);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual(
      ['cluster', 'container', 'db'].map((s) => expect.objectContaining({ label: s, insertText: s }))
    );
  });

  it('suggests tags after a scope (API v1)', async () => {
    const { provider, model } = setup('{ resource. }', 11, v1Tags);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual(
      v1Tags.map((s) => expect.objectContaining({ label: s, insertText: s }))
    );
  });

  it('suggests correct tags after the resource scope (API v2)', async () => {
    const { provider, model } = setup('{ resource. }', 11, undefined, v2Tags);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual(
      ['cluster', 'container'].map((s) => expect.objectContaining({ label: s, insertText: s }))
    );
  });

  it('suggests correct tags after the span scope (API v2)', async () => {
    const { provider, model } = setup('{ span. }', 7, undefined, v2Tags);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual(
      ['db'].map((s) => expect.objectContaining({ label: s, insertText: s }))
    );
  });

  it('suggests logical operators and close bracket after the value', async () => {
    const { provider, model } = setup('{.foo=300 }', 10, v1Tags);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual(
      [...CompletionProvider.logicalOps, ...CompletionProvider.arithmeticOps, ...CompletionProvider.comparisonOps].map(
        (s) => expect.objectContaining({ label: s.label, insertText: s.insertText })
      )
    );
  });

  it('suggests spanset combining operators after spanset selector', async () => {
    const { provider, model } = setup('{.foo=300} ', 11);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual(
      CompletionProvider.spansetOps.map((s) => expect.objectContaining({ label: s.label, insertText: s.insertText }))
    );
  });

  it.each([
    ['{.foo=300} | ', 13],
    ['{.foo=300} && {.bar=200} | ', 27],
    ['{.foo=300} && {.bar=300} && {.foo=300} | ', 41],
  ])(
    'suggests operators that go after `|` (aggregators, selectorts, ...) - %s, %i',
    async (input: string, offset: number) => {
      const { provider, model } = setup(input, offset, undefined, v2Tags);
      const result = await provider.provideCompletionItems(model, emptyPosition);
      expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
        ...CompletionProvider.functions.map((s) =>
          expect.objectContaining({ label: s.label, insertText: s.insertText, documentation: s.documentation })
        ),
        ...scopes.map((s) => expect.objectContaining({ label: s, insertText: s })),
        ...testIntrinsics.map((s) => expect.objectContaining({ label: s, insertText: s })),
        expect.objectContaining({ label: 'cluster', insertText: '.cluster' }),
        expect.objectContaining({ label: 'container', insertText: '.container' }),
        expect.objectContaining({ label: 'db', insertText: '.db' }),
      ]);
    }
  );

  it('suggests compare function in pipeline operators', async () => {
    const { provider, model } = setup('{.foo=300} | ', 13);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    const suggestions = (result! as monacoTypes.languages.CompletionList).suggestions;

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'compare',
          insertText: 'compare({$0})',
          documentation: expect.stringContaining('Splits spans into two groups'),
        }),
      ])
    );
  });

  it('suggests with keyword after spanset completion', async () => {
    const { provider, model } = setup('{.foo=300} ', 11);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    const suggestions = (result! as monacoTypes.languages.CompletionList).suggestions;

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'with',
          insertText: 'with($0)',
          documentation: expect.stringContaining('query hints'),
        }),
      ])
    );
  });

  it.each([
    ['{.foo=300} | avg(.value) ', 25],
    ['{.foo=300} && {.foo=300} | avg(.value) ', 39],
  ])(
    'suggests comparison operators after aggregator (avg, max, ...) - %s, %i',
    async (input: string, offset: number) => {
      const { provider, model } = setup(input, offset);
      const result = await provider.provideCompletionItems(model, emptyPosition);
      expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual(
        CompletionProvider.comparisonOps.map((s) =>
          expect.objectContaining({ label: s.label, insertText: s.insertText })
        )
      );
    }
  );

  it.each([
    ['{.foo=300} | avg(.value) = ', 27],
    ['{.foo=300} && {.foo=300} | avg(.value) = ', 41],
  ])('does not suggest after aggregator and comparison operator - %s, %i', async (input: string, offset: number) => {
    const { provider, model } = setup(input, offset);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([]);
  });

  it('suggests when `}` missing', async () => {
    const { provider, model } = setup('{ span.http.status_code ', 24);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual(
      [...CompletionProvider.comparisonOps, ...CompletionProvider.logicalOps].map((s) =>
        expect.objectContaining({ label: s.label, insertText: s.insertText })
      )
    );
  });

  it.each([
    ['{ .foo }', 7],
    ['{.foo   300}', 6],
    ['{.foo   300}', 7],
    ['{.foo   300}', 8],
    ['{.foo  300 && .bar = 200}', 6],
    ['{.foo  300 && .bar = 200}', 7],
    ['{.foo  300 && .bar  200}', 19],
    ['{.foo  300 && .bar  200}', 20],
    ['{ .foo = 1 && .bar }', 19],
    ['{ .foo = 1 && .bar  }', 19],
  ])('suggests with incomplete spanset - %s, %i', async (input: string, offset: number) => {
    const { provider, model } = setup(input, offset);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual(
      [...CompletionProvider.comparisonOps, ...CompletionProvider.logicalOps, ...CompletionProvider.arithmeticOps].map(
        (s) => expect.objectContaining({ label: s.label, insertText: s.insertText })
      )
    );
  });

  it.each([
    ['{ .foo }', 6],
    ['{.foo   300}', 5],
    ['{.foo  300 && .bar = 200}', 5],
    ['{ .foo = 1 && .bar }', 18],
  ])('suggests with incomplete spanset with no space before cursor - %s, %i', async (input: string, offset: number) => {
    const { provider, model } = setup(input, offset);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([]);
  });

  it.each([
    ['{ span.d }', 8],
    ['{ span.db }', 9],
  ])('suggests to complete attribute - %s, %i', async (input: string, offset: number) => {
    const { provider, model } = setup(input, offset, undefined, v2Tags);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
      expect.objectContaining({ label: 'db', insertText: 'db' }),
    ]);
  });

  it.each([
    ['{.foo=1}  {.bar=2}', 8],
    ['{.foo=1}  {.bar=2}', 9],
    ['{.foo=1}  {.bar=2}', 10],
  ])(
    'suggests spanset combining operators in an incomplete, multi-spanset query - %s, %i',
    async (input: string, offset: number) => {
      const { provider, model } = setup(input, offset);
      const result = await provider.provideCompletionItems(model, emptyPosition);
      expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual(
        CompletionProvider.spansetOps.map((completionItem) =>
          expect.objectContaining({
            detail: completionItem.detail,
            documentation: completionItem.documentation,
            insertText: completionItem.insertText,
            label: completionItem.label,
          })
        )
      );
    }
  );

  it.each([
    // After spanset
    ['{ span.http.status_code = 200 &&  }', 33],
    ['{ span.http.status_code = 200 ||  }', 33],
    ['{ span.http.status_code = 200 &&   }', 34],
    ['{ span.http.status_code = 200 ||   }', 34],
    ['{ span.http.status_code = 200 &&   }', 35],
    ['{ span.http.status_code = 200 ||   }', 35],
    ['{ .foo = 200 } &&  ', 18],
    ['{ .foo = 200 } &&  ', 19],
    ['{ .foo = 200 } || ', 18],
    ['{ .foo = 200 } >> ', 18],
    // Between spansets
    ['{ .foo = 1 } &&  { .bar = 2 }', 16],
    // Inside `()`
    ['{.foo=1} | avg()', 15],
    ['{.foo=1} | avg() < 1s', 15],
    ['{.foo=1} | max() = 3', 15],
    ['{.foo=1} | by()', 14],
    ['{.foo=1} | select()', 18],
  ])('suggests attributes - %s, %i', async (input: string, offset: number) => {
    const { provider, model } = setup(input, offset);
    const result = await provider.provideCompletionItems(model, emptyPosition);
    expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual(
      [...scopes, ...intrinsicsV1].map((s) => expect.objectContaining({ label: s }))
    );
  });

  it.each([
    ['{span.ht', 8],
    ['{span.http', 10],
    ['{span.http.', 11],
    ['{span.http.status', 17],
  ])(
    'suggests attributes when containing trigger characters and missing `}`- %s, %i',
    async (input: string, offset: number) => {
      const { provider, model } = setup(input, offset, undefined, [
        {
          name: 'span',
          tags: ['http.status_code'],
        },
      ]);
      const result = await provider.provideCompletionItems(model, emptyPosition);
      expect((result! as monacoTypes.languages.CompletionList).suggestions).toEqual([
        expect.objectContaining({ label: 'http.status_code', insertText: 'http.status_code' }),
      ]);
    }
  );

  describe('Query hint autocompletion', () => {
    it('suggests most_recent parameter inside with clause', async () => {
      const { provider, model } = setup('{.foo=300} with(', 17);
      const result = await provider.provideCompletionItems(model, emptyPosition);
      const suggestions = (result! as monacoTypes.languages.CompletionList).suggestions;

      expect(suggestions).toEqual([
        expect.objectContaining({
          label: 'most_recent',
          insertText: 'most_recent=$0',
          detail: 'Get latest traces',
          documentation: expect.stringContaining('Forces Tempo to return the most recent results'),
        }),
      ]);
    });

    it('suggests boolean values after most_recent parameter', async () => {
      const { provider, model } = setup('{.foo=300} with(most_recent=', 29);
      const result = await provider.provideCompletionItems(model, emptyPosition);
      const suggestions = (result! as monacoTypes.languages.CompletionList).suggestions;

      expect(suggestions).toEqual([
        expect.objectContaining({
          label: 'true',
          insertText: 'true',
          detail: 'Boolean true',
        }),
        expect.objectContaining({
          label: 'false',
          insertText: 'false',
          detail: 'Boolean false',
        }),
      ]);
    });

    it('suggests most_recent parameter with whitespace variations', async () => {
      const { provider, model } = setup('{.foo=300} with( ', 18);
      const result = await provider.provideCompletionItems(model, emptyPosition);
      const suggestions = (result! as monacoTypes.languages.CompletionList).suggestions;

      expect(suggestions).toEqual([
        expect.objectContaining({
          label: 'most_recent',
          insertText: 'most_recent=$0',
        }),
      ]);
    });

    it('suggests boolean values with whitespace around equals', async () => {
      const { provider, model } = setup('{.foo=300} with(most_recent = ', 31);
      const result = await provider.provideCompletionItems(model, emptyPosition);
      const suggestions = (result! as monacoTypes.languages.CompletionList).suggestions;

      expect(suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'true', insertText: 'true' }),
          expect.objectContaining({ label: 'false', insertText: 'false' }),
        ])
      );
    });
  });
});

function setup(value: string, offset: number, tagsV1?: string[], tagsV2?: Scope[]) {
  const ds = new TempoDatasource(defaultSettings);
  const lp = new TempoLanguageProvider(ds);
  if (tagsV1) {
    lp.setV1Tags(tagsV1);
  } else if (tagsV2) {
    lp.setV2Tags(tagsV2);
  }
  const provider = new CompletionProvider({ languageProvider: lp, setAlertText: () => {} });
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
  } as unknown as typeof monacoTypes;
  provider.editor = {
    getModel() {
      return model;
    },
  } as unknown as monacoTypes.editor.IStandaloneCodeEditor;

  return { provider, model } as unknown as { provider: CompletionProvider; model: monacoTypes.editor.ITextModel };
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
    info: {} as PluginMetaInfo,
    module: '',
    baseUrl: '',
  },
  readOnly: false,
  jsonData: {
    nodeGraph: {
      enabled: true,
    },
  },
};
