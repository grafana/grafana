import { useMemo } from 'react';

import { Select } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { LayoutOrchestrator } from '../layout-manager/LayoutOrchestrator';
import { getClosest } from '../layout-manager/utils';
import { DashboardLayoutManager, LayoutRegistryItem } from '../types';

import { layoutRegistry } from './layoutRegistry';

export interface Props {
  layoutOrchestrator: LayoutOrchestrator;
}

export function DashboardLayoutSelector({ layoutOrchestrator }: Props) {
  const { manager } = layoutOrchestrator.useState();
  const currentLayoutId = useMemo(() => manager.getDescriptor().id, [manager]);
  const options = layoutRegistry.list().map((layout) => ({
    label: layout.name,
    value: layout,
  }));

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

    console.log(layoutManager);
    const layoutOrchestrator = getClosest(layoutManager, (s) => (s instanceof LayoutOrchestrator ? s : undefined));
    console.log(`Layout orchestrator: ${layoutOrchestrator}`);
    if (layoutOrchestrator) {
      console.log('orchestrator found!');
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
