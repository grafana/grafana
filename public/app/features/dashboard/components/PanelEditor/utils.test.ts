import { FieldConfig, FieldConfigSource, PanelPlugin, standardFieldConfigEditorRegistry } from '@grafana/data';
import { supportsDataQuery, updateDefaultFieldConfigValue } from './utils';

describe('standardFieldConfigEditorRegistry', () => {
  const dummyConfig: FieldConfig = {
    displayName: 'Hello',
    min: 10,
    max: 10,
    decimals: 10,
    thresholds: {} as any,
    noValue: 'no value',
    unit: 'km/s',
    links: {} as any,
  };

  it('make sure all fields have a valid name', () => {
    standardFieldConfigEditorRegistry.list().forEach(v => {
      if (!dummyConfig.hasOwnProperty(v.id)) {
        fail(`Registry uses unknown property: ${v.id}`);
      }
    });
  });
});

describe('supportsDataQuery', () => {
  describe('when called with plugin that supports queries', () => {
    it('then it should return true', () => {
      const plugin = ({ meta: { skipDataQuery: false } } as unknown) as PanelPlugin;
      expect(supportsDataQuery(plugin)).toBe(true);
    });
  });

  describe('when called with plugin that does not support queries', () => {
    it('then it should return false', () => {
      const plugin = ({ meta: { skipDataQuery: true } } as unknown) as PanelPlugin;
      expect(supportsDataQuery(plugin)).toBe(false);
    });
  });

  describe('when called without skipDataQuery', () => {
    it('then it should return false', () => {
      const plugin = ({ meta: {} } as unknown) as PanelPlugin;
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
