import { useMemo } from 'react';

import { Input } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { EditPaneHeader } from '../../edit-pane/EditPaneHeader';
import { useLayoutCategory } from '../layouts-shared/DashboardLayoutSelector';
import { useEditPaneInputAutoFocus } from '../layouts-shared/utils';

import { TabItem } from './TabItem';

export function getEditOptions(model: TabItem): OptionsPaneCategoryDescriptor[] {
  const tabOptions = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({
      title: '',
      id: 'tab-options',
      isOpenable: false,
      renderTitle: () => (
        <EditPaneHeader title={t('dashboard.tabs-layout.tab-options.title', 'Tab')} onDelete={() => model.onDelete()} />
      ),
    }).addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.tabs-layout.tab-options.title-option', 'Title'),
        render: () => <TabTitleInput tab={model} />,
      })
    );
  }, [model]);

  const { layout } = model.useState();
  const layoutOptions = useLayoutCategory(layout);

  return [tabOptions, layoutOptions];
}

function TabTitleInput({ tab }: { tab: TabItem }) {
  const { title } = tab.useState();
  const ref = useEditPaneInputAutoFocus();

  return <Input ref={ref} value={title} onChange={(e) => tab.onChangeTitle(e.currentTarget.value)} />;
}
