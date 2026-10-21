import {
  type FieldConfig,
  type FieldConfigSource,
  type PanelPlugin,
  standardFieldConfigEditorRegistry,
  ThresholdsMode,
} from '@grafana/data';

import {
  setOptionImmutably,
  supportsDataQuery,
  updateDefaultFieldConfigValue,
  updateDefaultFieldConfigVarMapping,
  updateDefaultThresholdStepVarMappings,
  updateOverrideThresholds,
  withThresholdStepExpressions,
} from './utils';

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

describe('updateDefaultFieldConfigVarMapping', () => {
  it('sets a varMappings entry on an empty defaults object', () => {
    const config: FieldConfigSource = { defaults: { min: 0 }, overrides: [] };
    const result = updateDefaultFieldConfigVarMapping(config, 'min', '$myVar');

    expect(result.defaults).toEqual({ min: 0, varMappings: { min: '$myVar' } });
    // the property's own stored value is untouched - it stays the numeric fallback
    expect(result.defaults.min).toBe(0);
  });

  it('adds a second entry alongside an existing varMappings entry for a different id', () => {
    const config: FieldConfigSource = { defaults: { min: 0, max: 100, varMappings: { min: '$a' } }, overrides: [] };
    const result = updateDefaultFieldConfigVarMapping(config, 'max', '$b');

    expect(result.defaults.varMappings).toEqual({ min: '$a', max: '$b' });
  });

  it('overwrites an existing entry for the same id', () => {
    const config: FieldConfigSource = { defaults: { min: 0, varMappings: { min: '$old' } }, overrides: [] };
    const result = updateDefaultFieldConfigVarMapping(config, 'min', '$new');

    expect(result.defaults.varMappings).toEqual({ min: '$new' });
  });

  it('removes the entry (expr: undefined), dropping the whole varMappings key once empty', () => {
    const config: FieldConfigSource = { defaults: { min: 0, varMappings: { min: '$a' } }, overrides: [] };
    const result = updateDefaultFieldConfigVarMapping(config, 'min', undefined);

    expect(result.defaults).toEqual({ min: 0 });
    expect(result.defaults.varMappings).toBeUndefined();
  });

  it('removing one entry leaves a sibling entry for a different id in place', () => {
    const config: FieldConfigSource = {
      defaults: { min: 0, max: 100, varMappings: { min: '$a', max: '$b' } },
      overrides: [],
    };
    const result = updateDefaultFieldConfigVarMapping(config, 'min', undefined);

    expect(result.defaults.varMappings).toEqual({ max: '$b' });
  });

  it('is a no-op when removing an id that has no entry', () => {
    const config: FieldConfigSource = { defaults: { min: 0 }, overrides: [] };
    const result = updateDefaultFieldConfigVarMapping(config, 'min', undefined);

    expect(result).toBe(config);
  });

  it('does not mutate the input config', () => {
    const config: FieldConfigSource = { defaults: { min: 0, varMappings: { min: '$a' } }, overrides: [] };
    const before = JSON.parse(JSON.stringify(config));

    updateDefaultFieldConfigVarMapping(config, 'min', '$new');
    updateDefaultFieldConfigVarMapping(config, 'max', '$b');
    updateDefaultFieldConfigVarMapping(config, 'min', undefined);

    expect(config).toEqual(before);
  });
});

describe('threshold step expressions', () => {
  const thresholds = {
    mode: ThresholdsMode.Absolute,
    steps: [
      { value: -Infinity, color: 'green' },
      { value: 50, color: 'orange' },
      { value: 80, color: 'red' },
    ],
  };

  it('gives non-base steps their expression as valueExpr', () => {
    const expressions: Record<string, string> = { 'thresholds.steps.0': '$base', 'thresholds.steps.2': '$high' };

    expect(withThresholdStepExpressions(thresholds, (key) => expressions[key])?.steps).toEqual([
      { value: -Infinity, color: 'green' },
      { value: 50, color: 'orange' },
      { value: 80, color: 'red', valueExpr: '$high' },
    ]);
  });

  it('replaces every step key in defaults.varMappings and keeps other mappings', () => {
    const config: FieldConfigSource = {
      defaults: { varMappings: { min: '$min', 'thresholds.steps.1': '$old', 'thresholds.steps.3': '$stale' } },
      overrides: [],
    };

    expect(
      updateDefaultThresholdStepVarMappings(config, { 'thresholds.steps.2': '$new' }).defaults.varMappings
    ).toEqual({
      min: '$min',
      'thresholds.steps.2': '$new',
    });
  });

  it('removes defaults.varMappings once no mapping is left', () => {
    const config: FieldConfigSource = { defaults: { varMappings: { 'thresholds.steps.1': '$old' } }, overrides: [] };

    expect(updateDefaultThresholdStepVarMappings(config, {}).defaults).toEqual({});
  });

  it("re-keys an override rule's step entries from the edited steps", () => {
    const properties = [
      { id: 'thresholds', value: thresholds },
      { id: 'varMappings.thresholds.steps.1', value: '$old' },
      { id: 'varMappings.min', value: '$min' },
      { id: 'min', value: 1 },
    ];
    const edited = {
      ...thresholds,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 10, color: 'red' },
        { value: 50, color: 'orange', valueExpr: '$old' },
      ],
    };

    expect(updateOverrideThresholds(properties, 0, edited)).toEqual([
      {
        id: 'thresholds',
        value: {
          ...thresholds,
          steps: [
            { value: -Infinity, color: 'green' },
            { value: 10, color: 'red' },
            { value: 50, color: 'orange' },
          ],
        },
      },
      { id: 'varMappings.min', value: '$min' },
      { id: 'min', value: 1 },
      { id: 'varMappings.thresholds.steps.2', value: '$old' },
    ]);
  });
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
