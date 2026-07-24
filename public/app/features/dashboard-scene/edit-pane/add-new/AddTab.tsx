import { useCallback, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { addNewTabTo } from '../../scene/layouts-shared/addNew';
import { getNestingRestrictionMessage, useNestingRestrictions } from '../../scene/layouts-shared/nestingRestrictions';
import { isLayoutParent } from '../../scene/types/LayoutParent';
import { type DashboardSceneLike } from '../../scene/types/dashboard';

import { AddButton } from './AddButton';

interface AddTabProps {
  dashboardScene: DashboardSceneLike;
  selectedElement: SceneObject | undefined;
}

export function AddTab({ dashboardScene, selectedElement }: AddTabProps) {
  const layout = useMemo(() => {
    if (selectedElement && isLayoutParent(selectedElement)) {
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
      return getNestingRestrictionMessage();
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
