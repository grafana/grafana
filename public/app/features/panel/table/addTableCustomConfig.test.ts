import { FieldConfigEditorBuilder, standardEditorsRegistry } from '@grafana/data';
import { type TableFieldOptions } from '@grafana/schema';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';

import { addTableCustomConfig } from './addTableCustomConfig';

// The builder resolves editors as options are added.
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

  it('passes the caller’s gate through to the column filter switch', () => {
    const showIf = jest.fn(() => false);
    const item = filterableItem({ filters: true, filtersShowIf: showIf });

    expect(item!.showIf).toBe(showIf);
  });
});
