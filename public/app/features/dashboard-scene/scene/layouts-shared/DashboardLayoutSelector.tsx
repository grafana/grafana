import { useCallback, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { RadioButtonGroup, Box, ConfirmModal } from '@grafana/ui';
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
  const isGridLayout = layoutManager.descriptor.isGridLayout;
  const options = layoutRegistry.list().filter((layout) => layout.isGridLayout === isGridLayout);
  const [newLayout, setNewLayout] = useState<LayoutRegistryItem | undefined>();

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

  const radioOptions = options.map((opt) => ({
    value: opt,
    label: opt.name,
    icon: opt.icon,
    description: opt.description,
    ariaLabel: `layout-selection-option-${opt.name}`,
  }));

  return (
    <>
      <Box paddingBottom={2} display="flex" grow={1} alignItems="center">
        <RadioButtonGroup fullWidth value={layoutManager.descriptor} options={radioOptions} onChange={onChangeLayout} />
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
    const isGridLayout = layoutManager.descriptor.isGridLayout;

    const groupLayout = new OptionsPaneCategoryDescriptor({
      title: t('dashboard.layout.common.group-layout', 'Group layout'),
      id: 'dash-group-layout',
      isOpenDefault: false,
    });

    const gridLayout = new OptionsPaneCategoryDescriptor({
      title: t('dashboard.layout.common.panel-layout', 'Panel layout'),
      id: 'dash-grid-layout',
      isOpenDefault: false,
    });

    gridLayout.addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: 'dash-grid-layout-option',
        skipField: true,
        render: () => <DashboardLayoutSelector layoutManager={layoutManager} />,
      })
    );

    if (isGridLayout) {
      groupLayout.props.disabledText = t(
        'dashboard.layout.common.group-layout-disabled',
        'No groups exists on this level'
      );
    } else {
      groupLayout.addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: 'dash-group-layout-option',
          skipField: true,
          render: () => <DashboardLayoutSelector layoutManager={layoutManager} />,
        })
      );

      gridLayout.props.disabledText = t(
        'dashboard.layout.common.panel-layout-disabled',
        'Select a row or tab to change panel layout options'
      );
    }

    if (layoutManager.getOptions) {
      for (const option of layoutManager.getOptions()) {
        gridLayout.addItem(option);
      }
    }

    return [groupLayout, gridLayout];
  }, [layoutManager]);
}
