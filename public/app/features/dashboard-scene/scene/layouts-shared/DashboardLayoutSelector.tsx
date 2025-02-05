import { useMemo } from 'react';

import { Select } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { layoutRegistry } from './layoutRegistry';
import { findParentLayout } from './utils';

export interface Props {
  layoutManager: DashboardLayoutManager;
}

export function DashboardLayoutSelector({ layoutManager }: Props) {
  const options = useMemo(() => {
    const parentLayout = findParentLayout(layoutManager);
    const parentLayoutId = parentLayout?.descriptor.id;

    return layoutRegistry
      .list()
      .filter((layout) => layout.id !== parentLayoutId)
      .map((layout) => ({
        label: layout.name,
        value: layout,
      }));
  }, [layoutManager]);

  const currentLayoutId = layoutManager.descriptor.id;
  const currentOption = options.find((option) => option.value.id === currentLayoutId);

  return (
    <Select
      options={options}
      value={currentOption}
      onChange={(option) => {
        if (option.value?.id !== currentOption?.value.id) {
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
