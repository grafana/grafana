import { useCallback, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { TabItem } from '../../scene/layout-tabs/TabItem';
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

  const { disableTabs } = useNestingRestrictions(layout);

  const onAddTabClick = useCallback(() => {
    addNewTabTo(layout);
  }, [layout]);

  return (
    <AddButton
      icon="layers"
      label={t('dashboard-scene.add-tab.label', 'Tabs')}
      onClick={onAddTabClick}
      disabled={disableTabs}
    />
  );
}
