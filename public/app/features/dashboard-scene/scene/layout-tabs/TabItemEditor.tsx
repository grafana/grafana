import { ReactNode, useMemo } from 'react';

import { Button, Input } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { useLayoutCategory } from '../layouts-shared/DashboardLayoutSelector';

import { TabItem } from './TabItem';

export function getEditOptions(model: TabItem): OptionsPaneCategoryDescriptor[] {
  const tabOptions = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({
      title: t('dashboard.tabs-layout.tab-options.title', 'Tab options'),
      id: 'tab-options',
      isOpenDefault: true,
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

export function renderActions(tab: TabItem): ReactNode {
  return (
    <>
      <Button size="sm" variant="secondary" icon="copy" />
      <Button size="sm" variant="destructive" fill="outline" onClick={() => tab.onDelete()} icon="trash-alt" />
    </>
  );
}

function TabTitleInput({ tab }: { tab: TabItem }) {
  const { title } = tab.useState();

  return <Input value={title} onChange={(e) => tab.onChangeTitle(e.currentTarget.value)} />;
}
