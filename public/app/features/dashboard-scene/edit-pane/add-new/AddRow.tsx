import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { addNewRowTo } from '../../scene/layouts-shared/addNew';

import { AddButton } from './AddButton';

interface AddRowProps {
  dashboardScene: DashboardScene;
  selectedElement: SceneObject | undefined;
}

export function AddRow({ dashboardScene, selectedElement }: AddRowProps) {
  const onAddRowClick = useCallback(() => {
    const layout =
      selectedElement instanceof RowItem || selectedElement instanceof TabItem
        ? selectedElement.getLayout()
        : dashboardScene.getLayout();

    addNewRowTo(layout);
  }, [dashboardScene, selectedElement]);

  return <AddButton icon="list-ul" label={t('dashboard-scene.add-row.label', 'Rows')} onClick={onAddRowClick} />;
}
