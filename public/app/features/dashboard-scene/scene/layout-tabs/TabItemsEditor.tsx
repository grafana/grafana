import { useMemo } from 'react';

import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { renderTitle } from '../../edit-pane/shared';

import { TabItems } from './TabItems';

export function getEditOptions(model: TabItems): OptionsPaneCategoryDescriptor[] {
  const tabOptions = useMemo(() => {
    const tabs = model.getTabs();
    return new OptionsPaneCategoryDescriptor({
      title: ``,
      id: 'ms-tab-options',
      isOpenDefault: true,
      alwaysExpanded: true,
      renderTitle: () => renderTitle({ title: `${tabs.length} Tabs Selected`, onDelete: model.onDelete }),
    });
  }, [model]);

  return [tabOptions];
}
