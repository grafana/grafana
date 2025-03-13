import { useMemo } from 'react';

import { RadioButtonGroup } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { layoutRegistry } from './layoutRegistry';

export interface Props {
  layoutManager: DashboardLayoutManager;
}

export function DashboardLayoutSelector({ layoutManager }: Props) {
  const options = useMemo(() => {
    const isGridLayout = layoutManager.descriptor.isGridLayout;

    return layoutRegistry
      .list()
      .filter((layout) => layout.isGridLayout === isGridLayout)
      .map((layout) => ({
        label: layout.name,
        value: layout.id,
      }));
  }, [layoutManager]);

  return (
    <RadioButtonGroup
      options={options}
      fullWidth={true}
      value={layoutManager.descriptor.id}
      onChange={(value) => {
        const layout = layoutRegistry.get(value);
        changeLayoutTo(layoutManager, layout);
      }}
    />
  );
}

export function useLayoutCategory(layoutManager: DashboardLayoutManager) {
  return useMemo(() => {
    const categoryName = layoutManager.descriptor.isGridLayout
      ? t('dashboard.layout.common.grid', 'Grid')
      : t('dashboard.layout.common.layout', 'Layout');

    const layoutCategory = new OptionsPaneCategoryDescriptor({
      title: categoryName,
      id: 'layout-options',
      isOpenDefault: true,
    });

    layoutCategory.addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        skipField: true,
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

function changeLayoutTo(currentLayout: DashboardLayoutManager, newLayoutDescriptor: LayoutRegistryItem) {
  const layoutParent = currentLayout.parent;
  if (layoutParent && isLayoutParent(layoutParent)) {
    layoutParent.switchLayout(newLayoutDescriptor.createFromLayout(currentLayout));
  }
}
