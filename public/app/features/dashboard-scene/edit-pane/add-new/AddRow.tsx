import { useCallback, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { RowItem } from '../../scene/layout-rows/RowItem';
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

  const onAddRowClick = useCallback(() => {
    addNewRowTo(layout);
  }, [layout]);

  return (
    <AddButton
      icon="list-ul"
      label={t('dashboard-scene.add-row.label', 'Rows')}
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
