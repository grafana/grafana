import { PanelOptionsEditorBuilder, standardEditorsRegistry } from '@grafana/data';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';

import { plugin } from './module';
import { type Options } from './options/types';

standardEditorsRegistry.setInit(getAllOptionEditors);

function buildItems() {
  const builder = new PanelOptionsEditorBuilder<Options>();
  plugin.getPanelOptionsSupplier()(builder, { data: [] });
  return builder.getItems();
}

describe('logs table module', () => {
  it('registers hover overflow as a disabled-by-default panel option', () => {
    const hoverOverflow = buildItems().find((item) => item.path === 'hoverOverflow');

    expect(hoverOverflow).toBeDefined();
    expect(hoverOverflow?.defaultValue).toBe(false);
  });
});
