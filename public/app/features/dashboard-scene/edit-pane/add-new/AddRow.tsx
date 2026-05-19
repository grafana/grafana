import { useCallback, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { type DashboardScene } from '../../scene/DashboardScene';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { useNestingRestrictions } from '../../scene/layouts-shared/CanvasGridAddActions';
import { addNewRowTo } from '../../scene/layouts-shared/addNew';

import { AddButton } from './AddButton';

interface AddRowProps {
  dashboardScene: DashboardScene;
  selectedElement: SceneObject | undefined;
}

export function AddRow({ dashboardScene, selectedElement }: AddRowProps) {
  const layout = useMemo(() => {
    if (selectedElement instanceof RowItem || selectedElement instanceof TabItem) {
      return selectedElement.getLayout();
    }

    return dashboardScene.getLayout();
  }, [dashboardScene, selectedElement]);

  const { disableGrouping } = useNestingRestrictions(layout);

  const label = useMemo(() => {
    if (layout instanceof RowsLayoutManager) {
      return t('dashboard-scene.add-row.add-label', 'Add row');
    }

    return t('dashboard-scene.add-row.group-label', 'Group into rows');
  }, [layout]);

  const onAddRowClick = useCallback(() => {
    addNewRowTo(layout);
  }, [layout]);

  return (
    <AddButton
      icon="list-ul"
      label={label}
      onClick={onAddRowClick}
      disabled={disableGrouping}
      tooltip={
        disableGrouping
          ? t('dashboard.canvas-actions.disabled-nested-grouping', 'Grouping is limited to 3 levels')
          : undefined
      }
    />
  );
}
