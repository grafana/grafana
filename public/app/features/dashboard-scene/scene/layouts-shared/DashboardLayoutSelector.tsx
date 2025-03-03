import { useMemo } from 'react';

import { sceneGraph } from '@grafana/scenes';
import { Select } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { LayoutOrchestrator } from '../layout-manager/LayoutOrchestrator';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { layoutRegistry } from './layoutRegistry';

export interface Props {
  layoutManager: DashboardLayoutManager;
}

export function DashboardLayoutSelector({ layoutManager }: Props) {
  const { options, currentOption } = useMemo(() => {
    const managerId = layoutManager.descriptor.id;
    const layouts = layoutRegistry.list().map((layout) => ({
      label: layout.name,
      value: layout,
    }));
    const currentOption = layouts.find((option) => option.value.id === managerId);

    return {
      options: layouts.filter((layout) => currentOption?.value !== layout.value),
      currentOption,
    };
  }, [layoutManager]);

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
        title: t('dashboard.layout.common.layout', 'Layout'),
        render: () => <DashboardLayoutSelector layoutManager={layoutManager} />,
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

function changeLayoutTo(layoutManager: DashboardLayoutManager, newLayoutDescriptor: LayoutRegistryItem) {
  try {
    const layoutOrchestrator = sceneGraph.getAncestor(layoutManager, LayoutOrchestrator);
    layoutOrchestrator.switchLayout(newLayoutDescriptor.createFromLayout(layoutManager));
  } catch (err) {
    console.warn(`Expected parent of layout manager with key "${layoutManager.state.key}" to be a layout orchestrator`);
  }
}
