import { useMemo } from 'react';

import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { EditPaneHeader } from '../../edit-pane/EditPaneHeader';

import { TabItems } from './TabItems';

export function getEditOptions(model: TabItems): OptionsPaneCategoryDescriptor[] {
  const tabOptions = useMemo(() => {
    const tabs = model.getTabs();
    return new OptionsPaneCategoryDescriptor({
      title: ``,
      id: 'ms-tab-options',
      isOpenable: false,
      renderTitle: () => (
        <EditPaneHeader
          title={t('dashboard.tabs-layout.multi-select.title', '{{length}} tabs selected', { length: tabs.length })}
          onDelete={() => model.onDelete()}
        />
      ),
    });
  }, [model]);

  return [tabOptions];
}
