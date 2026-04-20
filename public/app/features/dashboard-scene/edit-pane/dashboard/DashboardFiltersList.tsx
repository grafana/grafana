import { DragDropContext } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import { VariableHide } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { type SceneVariableSet, type SceneVariable, sceneUtils } from '@grafana/scenes';
import { Box, Button } from '@grafana/ui';

import { type DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';
import { openAddFilterForm } from '../add-new/AddFilters';

import { partitionVariablesByDisplay } from './DashboardVariablesList';
import { DraggableList } from './DraggableList';
import { createDragEndHandler } from './variablesDragEndHandler';

const ID_FILTERS_VISIBLE_LIST = 'filters-list-visible';
const ID_FILTERS_CONTROLS_MENU_LIST = 'filters-list-controls-menu';
const ID_FILTERS_HIDDEN_LIST = 'filters-list-hidden';

const DROPPABLE_TO_HIDE: Record<string, VariableHide> = {
  [ID_FILTERS_VISIBLE_LIST]: VariableHide.dontHide,
  [ID_FILTERS_CONTROLS_MENU_LIST]: VariableHide.inControlsMenu,
  [ID_FILTERS_HIDDEN_LIST]: VariableHide.hideVariable,
};

export function DashboardFiltersList({ variableSet }: { variableSet: SceneVariableSet }) {
  const { variables } = variableSet.useState();
  const filters = useMemo(() => variables.filter(sceneUtils.isAdHocVariable), [variables]);
  const { visible, controlsMenu, hidden } = useMemo(() => partitionVariablesByDisplay(filters), [filters]);

  const onClickFilter = useCallback((variable: SceneVariable) => {
    const { editPane } = getDashboardSceneFor(variable).state;
    editPane.selectObject(variable);
  }, []);

  const onDragEnd = useMemo(
    () =>
      createDragEndHandler(
        variableSet,
        {
          visible: ID_FILTERS_VISIBLE_LIST,
          controlsMenu: ID_FILTERS_CONTROLS_MENU_LIST,
          hidden: ID_FILTERS_HIDDEN_LIST,
        },
        visible,
        controlsMenu,
        hidden,
        t('dashboard-scene.filters-list.reorder-description', 'Reorder filters list'),
        DROPPABLE_TO_HIDE
      ),
    [variableSet, visible, controlsMenu, hidden]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <DraggableList
        items={visible}
        droppableId={ID_FILTERS_VISIBLE_LIST}
        title={t('dashboard-scene.filters-list.title-above-dashboard', 'Above dashboard ({{count}})', {
          count: visible.length,
        })}
        onClickItem={onClickFilter}
        renderItemLabel={renderItemLabel}
      />
      <DraggableList
        items={controlsMenu}
        droppableId={ID_FILTERS_CONTROLS_MENU_LIST}
        title={t('dashboard-scene.filters-list.title-controls-menu', 'Controls menu ({{count}})', {
          count: controlsMenu.length,
        })}
        onClickItem={onClickFilter}
        renderItemLabel={renderItemLabel}
      />
      <DraggableList
        items={hidden}
        droppableId={ID_FILTERS_HIDDEN_LIST}
        title={t('dashboard-scene.filters-list.title-hidden', 'Hidden ({{count}})', { count: hidden.length })}
        onClickItem={onClickFilter}
        renderItemLabel={renderItemLabel}
      />
    </DragDropContext>
  );
}

const renderItemLabel = (v: SceneVariable) => <span data-testid="filter-name">{v.state.name}</span>;

export function AddFilterButton({ dashboard }: { dashboard: DashboardScene }) {
  const onAddFilter = useCallback(() => {
    openAddFilterForm(dashboard, dashboard);
    DashboardInteractions.addFilterButtonClicked({ source: 'edit_pane' });
  }, [dashboard]);

  return (
    <Box display="flex" paddingTop={1} paddingBottom={1}>
      <Button fullWidth icon="plus" size="sm" variant="secondary" onClick={onAddFilter}>
        <Trans i18nKey="dashboard-scene.filters-list.add-filter">Add filter</Trans>
      </Button>
    </Box>
  );
}
