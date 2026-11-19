import { PanelOptionsEditorBuilder, standardEditorsRegistry, standardFieldConfigEditorRegistry } from '@grafana/data';
import { BigValueColorMode, BigValueTextMode } from '@grafana/schema';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { plugin } from './module';
import { defaultOptions, type Options } from './panelcfg.gen';

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

// The ids the options editor gives the stat panel's options: panel option ids, and field option paths with
// `custom.` in front of the plugin's own.
function getOptionIds() {
  const builder = new PanelOptionsEditorBuilder<Options>();
  plugin.getPanelOptionsSupplier()(builder, { data: [] });
  const fieldIds = plugin.fieldConfigRegistry.list().map((item) => (item.isCustom ? `custom.${item.path}` : item.path));
  return [...builder.getItems().map((item) => item.id), ...fieldIds];
}

function getQuickEdit(id: string) {
  const quickEdit = plugin.getQuickEdits().find((edit) => edit.id === id);
  if (!quickEdit) {
    throw new Error(`no quick edit "${id}"`);
  }
  return quickEdit;
}

describe('stat quick edits', () => {
  it('offers the quick edits in order of use', () => {
    expect(plugin.getQuickEdits().map((edit) => edit.id)).toEqual([
      'thresholds',
      'presets',
      'unit',
      'calculation',
      'color',
      'text',
    ]);
  });

  it('names only options the stat panel registers', () => {
    const ids = getOptionIds();
    const named = plugin.getQuickEdits().flatMap((edit) => edit.optionIds);

    expect(named.filter((id) => !ids.includes(id))).toEqual([]);
  });

  it('relabels only options it names', () => {
    for (const edit of plugin.getQuickEdits()) {
      expect(Object.keys(edit.labels ?? {}).filter((id) => !edit.optionIds.includes(id))).toEqual([]);
    }
  });

  it.each([
    { id: 'calculation', options: { reduceOptions: { calcs: ['mean'] } }, text: 'Mean' },
    { id: 'calculation', options: { reduceOptions: { calcs: [] } }, text: 'Last *' },
    { id: 'color', options: { colorMode: BigValueColorMode.BackgroundSolid }, text: 'Background Solid' },
    { id: 'text', options: { textMode: BigValueTextMode.ValueAndName }, text: 'Value and name' },
  ])('summarizes $id as $text', ({ id, options, text }) => {
    const summary = getQuickEdit(id).summary?.({
      options: { ...defaultOptions, ...options } as Options,
      fieldConfig: { defaults: {}, overrides: [] },
    });

    expect(summary).toEqual({ text });
  });
});
