import { useCallback, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { RadioButtonGroup, Box, ConfirmModal } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { layoutRegistry } from './layoutRegistry';

export interface Props {
  layoutManager: DashboardLayoutManager;
}

export function DashboardLayoutSelector({ layoutManager }: Props) {
  const isGridLayout = layoutManager.descriptor.isGridLayout;
  const options = layoutRegistry.list().filter((layout) => layout.isGridLayout === isGridLayout);
  const [newLayout, setNewLayout] = useState<LayoutRegistryItem | undefined>();

  const disableTabs = useMemo(() => {
    if (config.featureToggles.unlimitedLayoutsNesting) {
      return false;
    }
    let parent = layoutManager.parent;
    while (parent) {
      if (parent instanceof TabsLayoutManager) {
        return true;
      }
      parent = parent.parent;
    }

    return false;
  }, [layoutManager]);

  const onChangeLayout = useCallback((newLayout: LayoutRegistryItem) => setNewLayout(newLayout), []);

  const onConfirmNewLayout = useCallback(() => {
    if (!newLayout) {
      return;
    }

    const layoutParent = layoutManager.parent;

    if (layoutParent && isLayoutParent(layoutParent)) {
      layoutParent.switchLayout(newLayout.createFromLayout(layoutManager));
    }

    setNewLayout(undefined);
  }, [newLayout, layoutManager]);

  const onDismissNewLayout = useCallback(() => setNewLayout(undefined), []);

  const disabledOptions: LayoutRegistryItem[] = [];

  const radioOptions = options.map((opt) => {
    let description = opt.description;
    if (disableTabs && opt.id === TabsLayoutManager.descriptor.id) {
      description = t('dashboard.canvas-actions.disabled-nested-tabs', 'Tabs cannot be nested inside other tabs');
      disabledOptions.push(opt);
    }

    return {
      value: opt,
      label: opt.name,
      icon: opt.icon,
      description,
      ariaLabel: `layout-selection-option-${opt.name}`,
    };
  });

  return (
    <>
      <Box paddingBottom={2} display="flex" grow={1} alignItems="stretch" gap={2} direction={'column'}>
        <RadioButtonGroup
          fullWidth
          value={layoutManager.descriptor}
          options={radioOptions}
          onChange={onChangeLayout}
          disabledOptions={disabledOptions}
        />
      </Box>
      <ConfirmModal
        isOpen={!!newLayout}
        title={t('dashboard.layout.panel.modal.title', 'Change layout')}
        body={t('dashboard.layout.panel.modal.body', 'Changing the layout will reset all panel positions and sizes.')}
        confirmText={t('dashboard.layout.panel.modal.confirm', 'Change layout')}
        dismissText={t('dashboard.layout.panel.modal.dismiss', 'Cancel')}
        confirmButtonVariant="primary"
        onConfirm={onConfirmNewLayout}
        onDismiss={onDismissNewLayout}
      />
    </>
  );
}
export function useLayoutCategory(layoutManager: DashboardLayoutManager) {
  return useMemo(() => {
    const layout = new OptionsPaneCategoryDescriptor({
      title: t('dashboard.layout.common.layout', 'Layout'),
      id: 'layout',
      isOpenDefault: true,
    });

    layout.addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: 'dash-grid-layout-option',
        skipField: true,
        render: () => <DashboardLayoutSelector layoutManager={layoutManager} />,
      })
    );

    if (layoutManager.getOptions) {
      for (const option of layoutManager.getOptions()) {
        layout.addItem(option);
      }
    }

    return [layout];
  }, [layoutManager]);
}
