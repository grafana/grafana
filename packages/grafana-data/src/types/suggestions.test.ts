import { getSuggestionHash, PanelPluginVisualizationSuggestion } from './suggestions';

interface FakeOptions {
  foo?: number;
  bar?: string;
}

interface FakeFieldOptions {
  foo?: {
    a: number;
    b: number;
  };
  bar?: string;
}

describe('getSuggestionHash', () => {
  it.each<{
    name: string;
    a: Omit<PanelPluginVisualizationSuggestion<FakeOptions, FakeFieldOptions>, 'hash'>;
    b: Omit<PanelPluginVisualizationSuggestion<FakeOptions, FakeFieldOptions>, 'hash'>;
    expectEqual: boolean;
  }>([
    {
      name: 'should create different hashes for different pluginIds',
      a: { pluginId: 'a', name: 'my suggestion' },
      b: { pluginId: 'b', name: 'my suggestion' },
      expectEqual: false,
    },
    {
      name: 'should create different hashes for different options',
      a: { pluginId: 'a', name: 'my suggestion', options: { foo: 1 } },
      b: { pluginId: 'a', name: 'my suggestion', options: { foo: 2 } },
      expectEqual: false,
    },
    {
      name: 'should create different hashes for different fieldConfig',
      a: {
        pluginId: 'a',
        name: 'my suggestion',
        fieldConfig: { defaults: { custom: { bar: 'x', foo: { a: 1, b: 2 } } }, overrides: [] },
      },
      b: {
        pluginId: 'a',
        name: 'my suggestion',
        fieldConfig: { defaults: { custom: { bar: 'y', foo: { a: 1, b: 2 } } }, overrides: [] },
      },
      expectEqual: false,
    },
    {
      name: 'should create same hashes for same suggestions',
      a: {
        pluginId: 'a',
        name: 'my suggestion',
        options: { foo: 1, bar: 'x' },
        fieldConfig: { defaults: { custom: { bar: 'x', foo: { a: 1, b: 2 } } }, overrides: [] },
      },
      b: {
        pluginId: 'a',
        name: 'my suggestion',
        options: { bar: 'x', foo: 1 },
        fieldConfig: { defaults: { custom: { foo: { b: 2, a: 1 }, bar: 'x' } }, overrides: [] },
      },
      expectEqual: true,
    },
  ])('$name', ({ a, b, expectEqual }) => {
    const hashA = getSuggestionHash(a);
    const hashB = getSuggestionHash(b);

    if (expectEqual) {
      expect(hashA).toEqual(hashB);
    } else {
      expect(hashA).not.toEqual(hashB);
    }
  });
});
