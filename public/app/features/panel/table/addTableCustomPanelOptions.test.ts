import { PanelOptionsEditorBuilder, standardEditorsRegistry } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { type TableOptions } from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';

import { addTableCustomPanelOptions } from './addTableCustomPanelOptions';

// the builder resolves standard editors (boolean switch, number input, ...) as options are added,
// so the registry has to be initialised rather than relying on another test file having done it
standardEditorsRegistry.setInit(getAllOptionEditors);

const options: TableOptions = { frameIndex: 0, showHeader: true };

function optionAt(path: string) {
  const builder = new PanelOptionsEditorBuilder<TableOptions>();
  addTableCustomPanelOptions(builder);
  const item = builder.getItems().find((i) => i.path === path);
  if (!item) {
    throw new Error(`no panel option registered at path "${path}"`);
  }
  return item;
}

describe('addTableCustomPanelOptions', () => {
  afterEach(() => {
    setTestFlags({});
  });

  describe('showColumnsSidebar', () => {
    it('is offered when table.refresh is enabled', () => {
      setTestFlags({ [FlagKeys.TableRefresh]: true });
      expect(optionAt('showColumnsSidebar').showIf?.(options, [])).toBe(true);
    });

    it('is hidden without table.refresh, which is what introduces the sidebar', () => {
      setTestFlags({ [FlagKeys.TableRefresh]: false });
      expect(optionAt('showColumnsSidebar').showIf?.(options, [])).toBe(false);
    });
  });
});
