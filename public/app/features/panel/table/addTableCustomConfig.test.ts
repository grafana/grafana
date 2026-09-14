import { FieldConfigEditorBuilder, standardEditorsRegistry } from '@grafana/data';
import { type TableFieldOptions } from '@grafana/schema';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';

import { addTableCustomConfig } from './addTableCustomConfig';

// the builder resolves standard editors (boolean switch, number input, ...) as options are added,
// so the registry has to be initialised rather than relying on another test file having done it
standardEditorsRegistry.setInit(getAllOptionEditors);

function buildWith(options: Parameters<typeof addTableCustomConfig>[1]) {
  const builder = new FieldConfigEditorBuilder<TableFieldOptions>();
  addTableCustomConfig(builder, options);
  return builder.getItems();
}

const filterableItem = (options: Parameters<typeof addTableCustomConfig>[1]) =>
  buildWith(options).find((item) => item.path === 'filterable');

describe('addTableCustomConfig', () => {
  it('does not register the column filter switch unless the caller asks for it', () => {
    expect(filterableItem({})).toBeUndefined();
  });

  it('registers the column filter switch with no gate by default', () => {
    const item = filterableItem({ filters: true });

    expect(item).toBeDefined();
    expect(item!.showIf).toBeUndefined();
  });

  // The table panel hides it under `table.refreshNewFeatures`, where every column is filterable, but
  // the logs table still opts in per field — so the gate is the caller's, not this function's.
  it('passes the caller’s gate through to the column filter switch', () => {
    const showIf = jest.fn(() => false);
    const item = filterableItem({ filters: true, filtersShowIf: showIf });

    expect(item!.showIf).toBe(showIf);
  });
});
