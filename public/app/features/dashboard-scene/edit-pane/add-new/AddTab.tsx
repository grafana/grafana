import { useCallback, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { type DashboardScene } from '../../scene/DashboardScene';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { useNestingRestrictions } from '../../scene/layouts-shared/CanvasGridAddActions';
import { addNewTabTo } from '../../scene/layouts-shared/addNew';

import { AddButton } from './AddButton';

interface AddTabProps {
  dashboardScene: DashboardScene;
  selectedElement: SceneObject | undefined;
}

export function AddTab({ dashboardScene, selectedElement }: AddTabProps) {
  const layout = useMemo(() => {
    if (selectedElement instanceof RowItem || selectedElement instanceof TabItem) {
      return selectedElement.getLayout();
    }
    return dashboardScene.getLayout();
  }, [dashboardScene, selectedElement]);

  const { disableGrouping, disableTabs } = useNestingRestrictions(layout);

  const label = useMemo(() => {
    if (layout instanceof TabsLayoutManager) {
      return t('dashboard-scene.add-tab.add-label', 'Add tab');
    }

    return t('dashboard-scene.add-tab.group-label', 'Group into tabs');
  }, [layout]);

  const disabledTooltip = useMemo(() => {
    if (!disableTabs) {
      return undefined;
    }

    if (disableGrouping) {
      return t('dashboard.canvas-actions.disabled-nested-grouping', 'Grouping is limited to 3 levels');
    }

    return t('dashboard.canvas-actions.disabled-nested-tabs', 'Tabs cannot be nested inside other tabs');
  }, [disableGrouping, disableTabs]);

  const onAddTabClick = useCallback(() => {
    addNewTabTo(layout);
  }, [layout]);

  return (
    <AddButton icon="layers" label={label} onClick={onAddTabClick} disabled={disableTabs} tooltip={disabledTooltip} />
  );
}
