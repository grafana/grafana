import { useMemo } from 'react';

import { Select } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { getDashboardSceneFor } from '../../utils/utils';
import { DashboardLayoutManager, isLayoutParent, LayoutRegistryItem } from '../types';

import { layoutRegistry } from './layoutRegistry';

export interface Props {
  layoutManager: DashboardLayoutManager;
}

export function DashboardLayoutSelector({ layoutManager }: Props) {
  const dashboard = getDashboardSceneFor(layoutManager);
  const { body: rootLayoutManager } = dashboard.useState();
  const isRootLayout = rootLayoutManager === layoutManager;
  const rootLayoutManagerLevel = rootLayoutManager.getDescriptor().level;

  const options = layoutRegistry
    .list()
    .filter((layout) => isRootLayout || layout.level > rootLayoutManagerLevel)
    .map((layout) => ({
      label: layout.name,
      value: layout,
    }));

  const currentLayoutId = layoutManager.getDescriptor().id;
  const currentLayoutOption = options.find((option) => option.value.id === currentLayoutId);

  return (
    <Select
      options={options}
      value={currentLayoutOption}
      onChange={(option) => {
        if (option.value?.id !== currentLayoutOption?.value.id) {
          changeLayoutTo(layoutManager, option.value!);
        }
      }}
    />
  );
}

export function useLayoutCategory(layoutManager: DashboardLayoutManager) {
  return useMemo(() => {
    const layoutCategory = new OptionsPaneCategoryDescriptor({
      title: 'Layout',
      id: 'layout-options',
      isOpenDefault: true,
    });

    layoutCategory.addItem(
      new OptionsPaneItemDescriptor({
        title: 'Type',
        render: function renderTitle() {
          return <DashboardLayoutSelector layoutManager={layoutManager} />;
        },
      })
    );

    if (layoutManager.getOptions) {
      for (const option of layoutManager.getOptions()) {
        layoutCategory.addItem(option);
      }
    }

    return layoutCategory;
  }, [layoutManager]);
}

function changeLayoutTo(currentLayout: DashboardLayoutManager, newLayoutDescriptor: LayoutRegistryItem) {
  const layoutParent = currentLayout.parent;
  if (layoutParent && isLayoutParent(layoutParent)) {
    layoutParent.switchLayout(newLayoutDescriptor.createFromLayout(currentLayout));
  }
}
