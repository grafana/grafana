import { FieldType, standardEditorsRegistry, type Field, type StandardEditorsRegistryItem } from '@grafana/data';

import { getAllOptionEditors, getAllStandardFieldConfigs } from './registry';

standardEditorsRegistry.setInit(getAllOptionEditors);

describe('getAllOptionEditors', () => {
  it('returns all expected editor ids', () => {
    const editors = getAllOptionEditors();
    const ids = editors.map((e) => e.id);

    expect(ids).toEqual([
      'text',
      'number',
      'slider',
      'boolean',
      'radio',
      'select',
      'unit',
      'links',
      'actions',
      'stats-picker',
      'strings',
      'timezone',
      'fieldColor',
      'color',
      'multi-select',
      'field-name',
      'dashboard-uid',
      'mappings',
      'thresholds',
    ]);
  });

  it('registers unique ids', () => {
    const editors = getAllOptionEditors();
    const ids = editors.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each item has name, description where applicable, and an editor component', () => {
    const editors = getAllOptionEditors();
    for (const item of editors) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect((item as StandardEditorsRegistryItem<unknown>).editor).toBeDefined();
    }
  });
});

describe('getAllStandardFieldConfigs', () => {
  it('returns standard field config items with stable paths', () => {
    const configs = getAllStandardFieldConfigs();
    const paths = configs.map((c) => c.path);

    expect(paths).toEqual([
      'unit',
      'min',
      'max',
      'fieldMinMax',
      'decimals',
      'displayName',
      'color',
      'noValue',
      'links',
      'actions',
      'mappings',
      'thresholds',
      'filterable',
    ]);
  });

  it('fieldMinMax.shouldApply is only for number fields', () => {
    const configs = getAllStandardFieldConfigs();
    const fieldMinMax = configs.find((c) => c.id === 'fieldMinMax');
    expect(fieldMinMax).toBeDefined();
    expect(fieldMinMax!.shouldApply({ type: FieldType.number } as Field)).toBe(true);
    expect(fieldMinMax!.shouldApply({ type: FieldType.string } as Field)).toBe(false);
  });

  it('mappings.shouldApply skips time fields', () => {
    const configs = getAllStandardFieldConfigs();
    const mappings = configs.find((c) => c.id === 'mappings');
    expect(mappings!.shouldApply({ type: FieldType.time } as Field)).toBe(false);
    expect(mappings!.shouldApply({ type: FieldType.number } as Field)).toBe(true);
  });
});
