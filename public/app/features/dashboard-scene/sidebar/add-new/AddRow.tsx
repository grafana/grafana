import { useCallback, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { addNewRowTo } from '../../scene/layouts-shared/addNew';
import { getNestingRestrictionMessage, useNestingRestrictions } from '../../scene/layouts-shared/nestingRestrictions';
import { useIsLayoutEmpty } from '../../scene/layouts-shared/useIsLayoutEmpty';
import { isLayoutParent } from '../../scene/types/LayoutParent';
import { type DashboardSceneLike } from '../../scene/types/dashboard';

import { AddButton } from './AddButton';

interface AddRowProps {
  dashboardScene: DashboardSceneLike;
  selectedElement: SceneObject | undefined;
}

export function AddRow({ dashboardScene, selectedElement }: AddRowProps) {
  const layout = useMemo(() => {
    if (selectedElement && isLayoutParent(selectedElement)) {
      return selectedElement.getLayout();
    }

    return dashboardScene.getLayout();
  }, [dashboardScene, selectedElement]);

  const { disableGrouping } = useNestingRestrictions(layout);
  const isLayoutEmpty = useIsLayoutEmpty(layout);

  const label = useMemo(() => {
    // With no panels there is nothing to group, so present the action as a plain "add"
    if (layout instanceof RowsLayoutManager || isLayoutEmpty) {
      return t('dashboard.sidebar.add.row.add-label', 'Add row');
    }

    return t('dashboard.sidebar.add.row.group-label', 'Group into rows');
  }, [layout, isLayoutEmpty]);

  const onAddRowClick = useCallback(() => {
    addNewRowTo(layout);
  }, [layout]);

  return (
    <AddButton
      icon="list-ul"
      label={label}
      onClick={onAddRowClick}
      disabled={disableGrouping}
      tooltip={disableGrouping ? getNestingRestrictionMessage() : undefined}
    />
  );
}
