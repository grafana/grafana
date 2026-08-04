import { useCallback, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { RadioButtonGroup, Box, ConfirmModal } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager, isDashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';
import { type LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { hasDirectTabsChild } from './hasDirectTabsChild';
import { layoutRegistry } from './layoutRegistry';

export interface Props {
  layoutManager: DashboardLayoutManager;
}

export function DashboardLayoutSelector({ layoutManager }: Props) {
  const isGridLayout = layoutManager.descriptor.isGridLayout;
  const options = layoutRegistry.list().filter((layout) => layout.isGridLayout === isGridLayout);
  const [newLayout, setNewLayout] = useState<LayoutRegistryItem | undefined>();

  const disableTabsReason = useMemo((): 'parent' | 'child' | undefined => {
    let parent = layoutManager.parent;
    while (parent) {
      if (isDashboardLayoutManager(parent)) {
        if (parent instanceof TabsLayoutManager) {
          return 'parent';
        }
        break;
      }
      parent = parent.parent;
    }

    if (hasDirectTabsChild(layoutManager)) {
      return 'child';
    }

    return undefined;
  }, [layoutManager]);

  const promptLayoutChange = useCallback((newLayout: LayoutRegistryItem) => setNewLayout(newLayout), []);

  const switchLayout = useCallback(
    (layoutItem: LayoutRegistryItem) => {
      const layoutParent = layoutManager.parent;

      if (layoutParent && isLayoutParent(layoutParent)) {
        layoutParent.switchLayout(layoutItem.createFromLayout(layoutManager));
      }
    },
    [layoutManager]
  );

  const onConfirmNewLayout = useCallback(() => {
    if (!newLayout) {
      return;
    }

    switchLayout(newLayout);
    setNewLayout(undefined);
  }, [newLayout, switchLayout]);

  const onDismissNewLayout = useCallback(() => setNewLayout(undefined), []);

  const disabledOptions: string[] = [];

  const radioOptions = options.map((opt) => {
    let description = opt.description;
    if (disableTabsReason && opt.id === TabsLayoutManager.descriptor.id) {
      if (disableTabsReason === 'parent') {
        description = t('dashboard.canvas-actions.disabled-nested-tabs', 'Tabs cannot be nested inside other tabs');
      } else {
        description = t(
          'dashboard.canvas-actions.disabled-child-contains-tabs',
          'Cannot change to tabs because a row already contains tabs'
        );
      }
      disabledOptions.push(opt.id);
    }

    // The option value is the layout's stable id (not the registry item object) so that
    // RadioButtonGroup can emit a per-option data-testid keyed on it.
    return {
      value: opt.id,
      label: opt.name,
      icon: opt.icon,
      description,
      ariaLabel: `layout-selection-option-${opt.name}`,
    };
  });

  const onChangeLayout = useCallback(
    (id: string) => {
      const layoutItem = options.find((opt) => opt.id === id);
      if (!layoutItem) {
        return;
      }

      if (isGridLayout) {
        promptLayoutChange(layoutItem);
      } else {
        switchLayout(layoutItem);
      }
    },
    [options, isGridLayout, promptLayoutChange, switchLayout]
  );

  return (
    <>
      <Box paddingBottom={2} display="flex" grow={1} alignItems="stretch" gap={2} direction={'column'}>
        <RadioButtonGroup
          fullWidth
          value={layoutManager.descriptor.id}
          options={radioOptions}
          onChange={onChangeLayout}
          disabledOptions={disabledOptions}
        />
      </Box>
      {isGridLayout && (
        <ConfirmModal
          isOpen={!!newLayout}
          title={t('dashboard.layout.panel.modal.title', 'Change layout')}
          body={t('dashboard.layout.panel.modal.body', 'Changing the layout will reset all panel positions and sizes.')}
          confirmText={t('dashboard.layout.panel.modal.confirm', 'Change layout')}
          dismissText={t('dashboard.layout.panel.modal.dismiss', 'Cancel')}
          confirmVariant="primary"
          onConfirm={onConfirmNewLayout}
          onDismiss={onDismissNewLayout}
        />
      )}
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
