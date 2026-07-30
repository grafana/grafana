import { useCallback, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { addNewTabTo } from '../../scene/layouts-shared/addNew';
import { getDisableTabsMessage, useNestingRestrictions } from '../../scene/layouts-shared/nestingRestrictions';
import { useIsLayoutEmpty } from '../../scene/layouts-shared/useIsLayoutEmpty';
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

  const { disableTabs, disableTabsReason } = useNestingRestrictions(layout);
  const isLayoutEmpty = useIsLayoutEmpty(layout);

  const label = useMemo(() => {
    // With no panels there is nothing to group, so present the action as a plain "add"
    if (layout instanceof TabsLayoutManager || isLayoutEmpty) {
      return t('dashboard.sidebar.add.tab.add-label', 'Add tab');
    }

    return t('dashboard.sidebar.add.tab.group-label', 'Group into tabs');
  }, [layout, isLayoutEmpty]);

  const disabledTooltip = useMemo(() => getDisableTabsMessage(disableTabsReason), [disableTabsReason]);

  const onAddTabClick = useCallback(() => {
    addNewTabTo(layout);
  }, [layout]);

  return (
    <AddButton icon="layers" label={label} onClick={onAddTabClick} disabled={disableTabs} tooltip={disabledTooltip} />
  );
}
