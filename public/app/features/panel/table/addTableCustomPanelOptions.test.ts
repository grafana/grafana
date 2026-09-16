import { PanelOptionsEditorBuilder, standardEditorsRegistry } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { type TableOptions } from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';

import { addTableCustomPanelOptions } from './addTableCustomPanelOptions';

// The builder resolves editors as options are added.
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
    it('is offered when both table.refresh and table.refreshNewFeatures are enabled', () => {
      setTestFlags({ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: true });
      expect(optionAt('showColumnsSidebar').showIf?.(options, [])).toBe(true);
    });

    it('is hidden without table.refresh', () => {
      setTestFlags({ [FlagKeys.TableRefresh]: false, [FlagKeys.TableRefreshNewFeatures]: true });
      expect(optionAt('showColumnsSidebar').showIf?.(options, [])).toBe(false);
    });

    it('is hidden without table.refreshNewFeatures', () => {
      setTestFlags({ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: false });
      expect(optionAt('showColumnsSidebar').showIf?.(options, [])).toBe(false);
    });
  });
});
