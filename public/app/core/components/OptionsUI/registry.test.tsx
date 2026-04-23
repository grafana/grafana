import { act, render } from '@testing-library/react';
import { type ComponentType } from 'react';

import {
  FieldType,
  standardEditorsRegistry,
  type Field,
  type StandardEditorProps,
  type StandardEditorsRegistryItem,
} from '@grafana/data';

jest.mock('app/features/actions/ActionsInlineEditor', () => ({
  ActionsInlineEditor: () => <div />,
}));

jest.mock('app/core/components/Select/DashboardPicker', () => ({
  DashboardPicker: () => <div />,
}));

jest.mock('app/features/dimensions/editors/ThresholdsEditor/thresholds', () => ({
  ThresholdsValueEditor: () => <div />,
}));

jest.mock('app/features/dimensions/editors/ValueMappingsEditor/ValueMappingsEditor', () => ({
  ValueMappingsEditor: () => <div />,
}));

import { getAllOptionEditors, getAllStandardFieldConfigs } from './registry';

standardEditorsRegistry.setInit(getAllOptionEditors);

/** Array-valued editors need a defined array or they can throw on mount. */
const ARRAY_VALUE_EDITORS = new Set(['strings', 'stats-picker', 'links', 'actions']);

/** Select-style editors require `settings.options` (see SelectFieldConfigSettings). */
const OPTION_LIST_EDITORS = new Set(['radio', 'select', 'multi-select']);

function defaultEditorValue(id: string): unknown {
  if (ARRAY_VALUE_EDITORS.has(id)) {
    return [];
  }
  if (id === 'boolean') {
    return false;
  }
  return undefined;
}

function defaultItemSettings(id: string): object {
  if (OPTION_LIST_EDITORS.has(id)) {
    return { options: [] };
  }
  return {};
}

describe('getAllOptionEditors', () => {
  it('returns all expected editor ids in order', () => {
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

  describe.each(getAllOptionEditors())('$id option editor', (item: StandardEditorsRegistryItem) => {
    it('has a non-empty id and name', () => {
      expect(item.id.length).toBeGreaterThan(0);
      expect(item.name.length).toBeGreaterThan(0);
    });

    it('editor is a valid component', () => {
      expect(typeof item.editor === 'function' || typeof item.editor === 'object').toBe(true);
      expect(item.editor).not.toBeNull();
    });

    it('editor mounts without throwing', async () => {
      const Editor = item.editor as ComponentType<StandardEditorProps<unknown>>;
      const defaultValue = defaultEditorValue(item.id);
      const settings = defaultItemSettings(item.id);
      const editorItem = { ...item, settings } as unknown as StandardEditorsRegistryItem;

      await act(async () => {
        render(<Editor value={defaultValue} onChange={() => {}} item={editorItem} context={{ data: [] }} />);
      });
    });
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
    expect(mappings).toBeDefined();
    expect(mappings!.shouldApply({ type: FieldType.time } as Field)).toBe(false);
    expect(mappings!.shouldApply({ type: FieldType.number } as Field)).toBe(true);
  });
});
