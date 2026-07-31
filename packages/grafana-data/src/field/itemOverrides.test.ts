import { mockStandardFieldConfigOptions } from '../../test/helpers/fieldConfig';
import { createItemConfigRegistry } from '../panel/registryFactories';
import { createTheme } from '../themes/createTheme';
import { ItemMatcherID } from '../transformations/itemMatchers/ids';
import { type DataFrame } from '../types/dataFrame';
import { FieldConfigProperty } from '../types/fieldOverrides';
import { type ItemKindDescriptor, type ItemOverrideRule } from '../types/itemOverrides';

import { applyItemOverrides } from './itemOverrides';
import { standardEditorsRegistry, standardFieldConfigEditorRegistry } from './standardFieldConfigEditorRegistry';

standardFieldConfigEditorRegistry.setInit(() => mockStandardFieldConfigOptions());
standardEditorsRegistry.setInit(() => mockStandardFieldConfigOptions());

interface NodeItemConfig {
  nodeRadius: number;
}

const nodeKind: ItemKindDescriptor<NodeItemConfig> = {
  id: 'node',
  name: 'Nodes',
  getItems: () => [
    { id: 'eu-west', label: 'EU West' },
    { id: 'us-east', label: 'US East' },
    { id: 'gateway', label: 'Gateway' },
  ],
  standardOptions: {
    [FieldConfigProperty.Color]: {},
    [FieldConfigProperty.Unit]: {},
  },
  useCustomConfig: (builder) => {
    builder.addNumberInput({
      path: 'nodeRadius',
      name: 'Node radius',
    });
  },
};

const data: DataFrame[] = [];
const registry = createItemConfigRegistry(nodeKind, 'test');

// nodeKind.getItems ignores the context, so a minimal one suffices here
const context = {
  fieldConfig: { defaults: {}, overrides: [] },
  options: {},
  replaceVariables: (v: string) => v,
  theme: createTheme(),
};

function resolve(itemOverrides: ItemOverrideRule[]) {
  return applyItemOverrides({
    itemOverrides,
    kind: nodeKind,
    itemConfigRegistry: registry,
    data,
    context,
  });
}

function rule(kind: string, ids: string[], properties: Array<{ id: string; value?: unknown }>): ItemOverrideRule {
  return { matcher: { id: ItemMatcherID.byItemIds, kind, options: ids }, properties };
}

describe('applyItemOverrides', () => {
  it('returns an empty map when there are no rules', () => {
    expect(resolve([]).size).toBe(0);
    expect(
      applyItemOverrides({ itemOverrides: undefined, kind: nodeKind, itemConfigRegistry: registry, data, context }).size
    ).toBe(0);
  });

  it('only creates entries for items a rule matched', () => {
    const result = resolve([rule('node', ['eu-west'], [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }])]);

    expect([...result.keys()]).toEqual(['eu-west']);
    expect(result.get('eu-west')).toEqual({ color: { mode: 'fixed', fixedColor: 'red' } });
    expect(result.get('us-east')).toBeUndefined();
  });

  it('skips rules whose kind is not the one being resolved', () => {
    const result = resolve([
      rule('edge', ['eu-west'], [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }]),
      rule('node', ['us-east'], [{ id: 'color', value: { mode: 'fixed', fixedColor: 'blue' } }]),
    ]);

    expect([...result.keys()]).toEqual(['us-east']);
  });

  it('applies rules in array order, last write wins per property', () => {
    const result = resolve([
      rule('node', ['gateway'], [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }]),
      rule('node', ['gateway'], [{ id: 'color', value: { mode: 'fixed', fixedColor: 'green' } }]),
    ]);

    expect(result.get('gateway')).toEqual({ color: { mode: 'fixed', fixedColor: 'green' } });
  });

  it('merges disjoint properties from two rules touching the same item', () => {
    const result = resolve([
      rule('node', ['gateway'], [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }]),
      rule('node', ['gateway'], [{ id: 'unit', value: 'bytes' }]),
    ]);

    expect(result.get('gateway')).toEqual({
      color: { mode: 'fixed', fixedColor: 'red' },
      unit: 'bytes',
    });
  });

  it('writes custom. properties under custom, without the prefix in the path', () => {
    const result = resolve([rule('node', ['eu-west'], [{ id: 'custom.nodeRadius', value: 12 }])]);

    expect(result.get('eu-west')).toEqual({ custom: { nodeRadius: 12 } });
  });

  it('removes a property whose value resolves to undefined', () => {
    const result = resolve([
      rule(
        'node',
        ['eu-west'],
        [
          { id: 'unit', value: 'bytes' },
          { id: 'unit', value: undefined },
        ]
      ),
    ]);

    // The item still matched, so it gets an entry — but the property was unset again
    expect(result.get('eu-west')).toEqual({});
  });

  it('skips a rule with an unknown matcher id and warns', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = resolve([
      {
        matcher: { id: 'noSuchMatcher', kind: 'node', options: ['eu-west'] },
        properties: [{ id: 'unit', value: 'bytes' }],
      },
    ]);

    expect(result.size).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('noSuchMatcher'));
    warn.mockRestore();
  });

  it('ignores properties the kind registry does not offer', () => {
    const result = resolve([
      rule(
        'node',
        ['eu-west'],
        [
          { id: 'unit', value: 'bytes' },
          { id: 'thresholds', value: { mode: 'absolute', steps: [] } },
        ]
      ),
    ]);

    // `thresholds` is a standard option this kind did not opt into
    expect(result.get('eu-west')).toEqual({ unit: 'bytes' });
  });

  it('resolves byItemRegexp against the item label', () => {
    const result = applyItemOverrides({
      itemOverrides: [
        {
          matcher: { id: ItemMatcherID.byItemRegexp, kind: 'node', options: '/^US/' },
          properties: [{ id: 'unit', value: 'bytes' }],
        },
      ],
      kind: nodeKind,
      itemConfigRegistry: registry,
      data,
      context,
    });

    expect([...result.keys()]).toEqual(['us-east']);
  });
});

describe('createItemConfigRegistry', () => {
  it('offers only the standard options the kind opted into, plus its custom ones', () => {
    expect(
      registry
        .list()
        .map((item) => item.id)
        .sort()
    ).toEqual(['color', 'custom.nodeRadius', 'unit']);
  });

  it('defaults to color and links when the kind does not narrow the standard options', () => {
    const defaulted = createItemConfigRegistry({ id: 'slice', name: 'Slices', getItems: () => [] }, 'test');

    // The mock standard registry has no `links` entry, so only `color` survives here
    expect(defaulted.list().map((item) => item.id)).toEqual(['color']);
  });

  it('restricts the colour editor to fixed modes', () => {
    expect(registry.get('color').settings).toMatchObject({ byValueSupport: false, bySeriesSupport: false });
  });
});
