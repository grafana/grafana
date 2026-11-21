import { act } from '@testing-library/react';
import { type ComponentType } from 'react';
import { render } from 'test/test-utils';

import {
  FieldType,
  standardEditorsRegistry,
  type Field,
  type StandardEditorProps,
  type StandardEditorsRegistryItem,
} from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { getAllOptionEditors, getAllStandardFieldConfigs } from './registry';

standardEditorsRegistry.setInit(getAllOptionEditors);

/** Array-valued editors need a defined array or they can throw on mount. */
const ARRAY_VALUE_EDITORS = new Set(['strings', 'stats-picker', 'links', 'actions']);

/** Select-style editors require `settings.options` (see SelectFieldConfigSettings). */
const OPTION_LIST_EDITORS = new Set(['radio', 'select', 'multi-select']);

/**
 * Editors that can't mount cleanly in jsdom.
 * - thresholds: needs layout APIs
 * - dashboard-uid: mounts DashboardPicker, which boots UnifiedSearcher and getBackendSrv() via loadLocationInfo
 */
const SKIP_MOUNT_TEST = new Set(['thresholds', 'dashboard-uid']);

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
  it('registers unique ids', () => {
    const editors = getAllOptionEditors();
    const ids = editors.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toMatchSnapshot();
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

    if (!SKIP_MOUNT_TEST.has(item.id)) {
      it('editor mounts without throwing', async () => {
        const Editor = item.editor as ComponentType<StandardEditorProps<unknown>>;
        const defaultValue = defaultEditorValue(item.id);
        const settings = defaultItemSettings(item.id);
        const editorItem = { ...item, settings } as unknown as StandardEditorsRegistryItem;

        await act(async () => {
          render(<Editor value={defaultValue} onChange={() => {}} item={editorItem} context={{ data: [] }} />);
        });
      });
    }
  });
});

describe('getAllStandardFieldConfigs', () => {
  it('returns standard field config items with stable paths', () => {
    const configs = getAllStandardFieldConfigs();
    const paths = configs.map((c) => c.path);
    expect(paths.sort()).toMatchSnapshot();
  });

  it('fieldMinMax.shouldApply is only for number fields', () => {
    const configs = getAllStandardFieldConfigs();
    const fieldMinMax = configs.find((c) => c.id === 'fieldMinMax');
    expect(fieldMinMax).toBeDefined();
    expect(fieldMinMax!.shouldApply({ type: FieldType.number } as Field)).toBe(true);
    expect(fieldMinMax!.shouldApply({ type: FieldType.string } as Field)).toBe(false);
  });

  describe('with frame fields', () => {
    const frameField = { type: FieldType.frame } as Field;
    const getItem = (id: string) => getAllStandardFieldConfigs().find((c) => c.id === id)!;

    afterEach(() => {
      setTestFlags({});
    });

    it.each(['fieldMinMax', 'min', 'max'])('%s.shouldApply only applies when table.refreshNewFeatures is on', (id) => {
      setTestFlags({ [FlagKeys.TableRefreshNewFeatures]: false });
      expect(getItem(id).shouldApply(frameField)).toBe(false);

      setTestFlags({ [FlagKeys.TableRefreshNewFeatures]: true });
      expect(getItem(id).shouldApply(frameField)).toBe(true);
    });

    it('drops a fieldMinMax override on a frame field when table.refreshNewFeatures is off', () => {
      const fieldMinMax = getItem('fieldMinMax');

      setTestFlags({ [FlagKeys.TableRefreshNewFeatures]: false });
      expect(fieldMinMax.process(true, { field: frameField, data: [] })).toBeUndefined();
      expect(fieldMinMax.process(true, { field: { type: FieldType.number } as Field, data: [] })).toBe(true);

      setTestFlags({ [FlagKeys.TableRefreshNewFeatures]: true });
      expect(fieldMinMax.process(true, { field: frameField, data: [] })).toBe(true);
    });
  });

  it('mappings.shouldApply skips time fields', () => {
    const configs = getAllStandardFieldConfigs();
    const mappings = configs.find((c) => c.id === 'mappings');
    expect(mappings).toBeDefined();
    expect(mappings!.shouldApply({ type: FieldType.time } as Field)).toBe(false);
    expect(mappings!.shouldApply({ type: FieldType.number } as Field)).toBe(true);
  });
});
