import { act, render } from '@testing-library/react';

import { type StandardEditorsRegistryItem, type StandardEditorProps } from '@grafana/data';

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

import { getAllOptionEditors } from './registry';

// Some editors require non-undefined defaults to avoid crashing on mount:
// - array-value editors (strings, stats-picker, links, actions) need value=[]
// - radio needs settings.options to be an array
const ARRAY_VALUE_EDITORS = new Set(['strings', 'stats-picker', 'links', 'actions']);
const OPTION_LIST_EDITORS = new Set(['radio', 'select', 'multi-select']);

describe('getAllOptionEditors', () => {
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
      const Editor = item.editor as React.ComponentType<StandardEditorProps<unknown>>;
      const defaultValue = ARRAY_VALUE_EDITORS.has(item.id) ? [] : undefined;
      const defaultSettings = OPTION_LIST_EDITORS.has(item.id) ? { options: [] } : {};
      const editorItem = { ...item, settings: defaultSettings } as unknown as StandardEditorsRegistryItem;
      await act(async () => {
        render(<Editor value={defaultValue} onChange={() => {}} item={editorItem} context={{ data: [] }} />);
      });
    });
  });
});
