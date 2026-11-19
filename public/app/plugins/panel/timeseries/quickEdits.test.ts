import { PanelOptionsEditorBuilder, standardEditorsRegistry, standardFieldConfigEditorRegistry } from '@grafana/data';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { plugin } from './module';
import { type Options } from './panelcfg.gen';

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

// The ids the options editor gives the time series panel's options: panel option ids, and field option paths with
// `custom.` in front of the plugin's own.
function getOptionIds() {
  const builder = new PanelOptionsEditorBuilder<Options>();
  plugin.getPanelOptionsSupplier()(builder, { data: [] });
  const fieldIds = plugin.fieldConfigRegistry.list().map((item) => (item.isCustom ? `custom.${item.path}` : item.path));
  return [...builder.getItems().map((item) => item.id), ...fieldIds];
}

describe('time series quick edits', () => {
  it('offers the quick edits in order of use', () => {
    expect(plugin.getQuickEdits().map((edit) => edit.id)).toEqual([
      'unit',
      'presets',
      'legend',
      'range',
      'thresholds',
      'tooltip',
    ]);
  });

  it('names only options the time series panel registers', () => {
    const ids = getOptionIds();
    const named = plugin.getQuickEdits().flatMap((edit) => edit.optionIds);

    expect(named.filter((id) => !ids.includes(id))).toEqual([]);
  });
});
