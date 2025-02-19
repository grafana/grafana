import { useMemo } from 'react';

import { Select } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { LayoutOrchestrator } from '../layout-manager/LayoutOrchestrator';
import { getClosest } from '../layout-manager/utils';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { layoutRegistry } from './layoutRegistry';
import { findParentLayout } from './utils';

export interface Props {
  layoutOrchestrator: LayoutOrchestrator;
}

export function DashboardLayoutSelector({ layoutOrchestrator }: Props) {
  const { manager } = layoutOrchestrator.useState();
  const currentLayoutId = useMemo(() => manager.descriptor.id, [manager]);
  const options = useMemo(() => {
    const parentLayout = findParentLayout(layoutOrchestrator);
    const parentLayoutId = parentLayout?.descriptor.id;

    return layoutRegistry
      .list()
      .filter((layout) => layout.id !== parentLayoutId)
      .map((layout) => ({
        label: layout.name,
        value: layout,
      }));
  }, [layoutOrchestrator]);

  const currentOption = options.find((option) => option.value.id === currentLayoutId);

  return (
    <Select
      options={options}
      value={currentOption}
      onChange={(option) => {
        if (option.value?.id !== currentOption?.value.id) {
          changeLayoutTo(layoutOrchestrator, option.value!);
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

    const layoutOrchestrator = getClosest(layoutManager, (s) => (s instanceof LayoutOrchestrator ? s : undefined));
    if (layoutOrchestrator) {
      layoutCategory.addItem(
        new OptionsPaneItemDescriptor({
          title: 'Type',
          render: function renderTitle() {
            return <DashboardLayoutSelector layoutOrchestrator={layoutOrchestrator} />;
          },
        })
      );
    }

    if (layoutManager.getOptions) {
      for (const option of layoutManager.getOptions()) {
        layoutCategory.addItem(option);
      }
    }

    return layoutCategory;
  }, [layoutManager]);
}

function changeLayoutTo(layoutOrchestrator: LayoutOrchestrator, newLayoutDescriptor: LayoutRegistryItem) {
  layoutOrchestrator.switchLayout(newLayoutDescriptor.createFromLayout(layoutOrchestrator.state.manager));
}
