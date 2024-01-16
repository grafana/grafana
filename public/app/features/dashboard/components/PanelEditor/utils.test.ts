import {
  FieldConfig,
  FieldConfigSource,
  PanelPlugin,
  standardFieldConfigEditorRegistry,
  ThresholdsMode,
} from '@grafana/data';

import { setOptionImmutably, supportsDataQuery, updateDefaultFieldConfigValue } from './utils';

describe('standardFieldConfigEditorRegistry', () => {
  const dummyConfig: FieldConfig = {
    displayName: 'Hello',
    min: 10,
    max: 10,
    decimals: 10,
    thresholds: {
      mode: ThresholdsMode.Absolute,
      steps: [],
    },
    noValue: 'no value',
    unit: 'km/s',
    links: [],
  };

  it('make sure all fields have a valid name', () => {
    standardFieldConfigEditorRegistry.list().forEach((v) => {
      if (!dummyConfig.hasOwnProperty(v.id)) {
        fail(`Registry uses unknown property: ${v.id}`);
      }
    });
  });
});

describe('supportsDataQuery', () => {
  describe('when called with plugin that supports queries', () => {
    it('then it should return true', () => {
      const plugin = { meta: { skipDataQuery: false } } as unknown as PanelPlugin;
      expect(supportsDataQuery(plugin)).toBe(true);
    });
  });

  describe('when called with plugin that does not support queries', () => {
    it('then it should return false', () => {
      const plugin = { meta: { skipDataQuery: true } } as unknown as PanelPlugin;
      expect(supportsDataQuery(plugin)).toBe(false);
    });
  });

  describe('when called without skipDataQuery', () => {
    it('then it should return false', () => {
      const plugin = { meta: {} } as unknown as PanelPlugin;
      expect(supportsDataQuery(plugin)).toBe(false);
    });
  });

  describe('when called without plugin', () => {
    it('then it should return false', () => {
      expect(supportsDataQuery(undefined)).toBe(false);
    });
  });
});

describe('updateDefaultFieldConfigValue', () => {
  it.each`
    property | isCustom | newValue                    | expected
    ${'a'}   | ${false} | ${2}                        | ${{ a: 2, b: { c: 'nested default' }, custom: { d: 1, e: { f: 'nested custom' } } }}
    ${'b.c'} | ${false} | ${'nested default updated'} | ${{ a: 1, b: { c: 'nested default updated' }, custom: { d: 1, e: { f: 'nested custom' } } }}
    ${'a'}   | ${false} | ${undefined}                | ${{ b: { c: 'nested default' }, custom: { d: 1, e: { f: 'nested custom' } } }}
    ${'b'}   | ${false} | ${undefined}                | ${{ a: 1, custom: { d: 1, e: { f: 'nested custom' } } }}
    ${'b.c'} | ${false} | ${undefined}                | ${{ a: 1, b: {}, custom: { d: 1, e: { f: 'nested custom' } } }}
    ${'d'}   | ${true}  | ${2}                        | ${{ a: 1, b: { c: 'nested default' }, custom: { d: 2, e: { f: 'nested custom' } } }}
    ${'e.f'} | ${true}  | ${'nested custom updated'}  | ${{ a: 1, b: { c: 'nested default' }, custom: { d: 1, e: { f: 'nested custom updated' } } }}
    ${'d'}   | ${true}  | ${undefined}                | ${{ a: 1, b: { c: 'nested default' }, custom: { e: { f: 'nested custom' } } }}
    ${'e'}   | ${true}  | ${undefined}                | ${{ a: 1, b: { c: 'nested default' }, custom: { d: 1 } }}
    ${'e.f'} | ${true}  | ${undefined}                | ${{ a: 1, b: { c: 'nested default' }, custom: { d: 1, e: {} } }}
  `(
    'when updating property:$property (is custom: $isCustom) with $newValue',
    ({ property, isCustom, newValue, expected }) => {
      const config = {
        defaults: {
          a: 1,
          b: {
            c: 'nested default',
          },
          custom: {
            d: 1,
            e: { f: 'nested custom' },
          },
        },
        overrides: [],
      };
      expect(updateDefaultFieldConfigValue(config as FieldConfigSource, property, newValue, isCustom).defaults).toEqual(
        expected
      );
    }
  );
});

describe('setOptionImmutably', () => {
  it.each`
    source                    | path          | value     | expected
    ${{}}                     | ${'a'}        | ${1}      | ${{ a: 1 }}
    ${{}}                     | ${'a.b.c'}    | ${[1, 2]} | ${{ a: { b: { c: [1, 2] } } }}
    ${{ a: {} }}              | ${'a.b.c'}    | ${[1, 2]} | ${{ a: { b: { c: [1, 2] } } }}
    ${{ b: {} }}              | ${'a.b.c'}    | ${[1, 2]} | ${{ a: { b: { c: [1, 2] } }, b: {} }}
    ${{ a: { b: { c: 3 } } }} | ${'a.b.c'}    | ${[1, 2]} | ${{ a: { b: { c: [1, 2] } } }}
    ${{}}                     | ${'a.b[2]'}   | ${'x'}    | ${{ a: { b: [undefined, undefined, 'x'] } }}
    ${{}}                     | ${'a[0]'}     | ${1}      | ${{ a: [1] }}
    ${{}}                     | ${'a[0].b.c'} | ${1}      | ${{ a: [{ b: { c: 1 } }] }}
    ${{ a: [{ b: 1 }] }}      | ${'a[0].c'}   | ${2}      | ${{ a: [{ b: 1, c: 2 }] }}
  `('property value:${value', ({ source, path, value, expected }) => {
    expect(setOptionImmutably(source, path, value)).toEqual(expected);
  });

  it('does not mutate object under a path', () => {
    const input = { a: { b: { c: { d: 1 }, e: { f: 1 } } }, aa: 1 };
    const result = setOptionImmutably(input, 'a.b.c', { d: 2 });
    expect(input.a).not.toEqual(result.a);
    expect(input.aa).toEqual(result.aa);
    expect(input.a.b).not.toEqual(result.a.b);
    expect(input.a.b.c).not.toEqual(result.a.b.c);
    expect(input.a.b.e).toEqual(result.a.b.e);
  });
});
