import { DragDropContext } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import { VariableHide } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type SceneVariableSet, type SceneVariable, sceneUtils } from '@grafana/scenes';

import { duplicateVariable } from '../../actions/variable/duplicateVariable';
import { type DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';
import { openAddFilterForm } from '../add-new/AddFilters';

import { partitionVariablesByDisplay } from './DashboardVariablesList';
import { DraggableList } from './DraggableList';
import { SidebarAddButton } from './SidebarAddButton';
import { selectSidebarObject, toDraggableListItemActions } from './helpers';
import { confirmDeleteVariable, createDragEndHandler } from './variableListActions';

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

  const filterActions = toDraggableListItemActions<SceneVariable>(
    selectSidebarObject,
    duplicateVariable,
    confirmDeleteVariable
  );

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
        t('dashboard.sidebar.filters.reorder-description', 'Reorder filters list'),
        DROPPABLE_TO_HIDE
      ),
    [variableSet, visible, controlsMenu, hidden]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <DraggableList
        items={visible}
        droppableId={ID_FILTERS_VISIBLE_LIST}
        title={t('dashboard.sidebar.filters.title-above-dashboard', 'Above dashboard')}
        renderItemLabel={renderItemLabel}
        {...filterActions}
      />
      <DraggableList
        items={controlsMenu}
        droppableId={ID_FILTERS_CONTROLS_MENU_LIST}
        title={t('dashboard.sidebar.filters.title-controls-menu', 'Controls menu')}
        renderItemLabel={renderItemLabel}
        {...filterActions}
      />
      <DraggableList
        items={hidden}
        droppableId={ID_FILTERS_HIDDEN_LIST}
        title={t('dashboard.sidebar.filters.title-hidden', 'Hidden')}
        renderItemLabel={renderItemLabel}
        {...filterActions}
      />
    </DragDropContext>
  );
}

const renderItemLabel = (v: SceneVariable) => <span data-testid="filter-name">{v.state.name}</span>;

export function AddFilterIconButton({ dashboard }: { dashboard: DashboardScene }) {
  const onAddFilter = useCallback(() => {
    void openAddFilterForm(dashboard, dashboard);
    DashboardInteractions.addFilterButtonClicked({ source: 'edit_pane' });
  }, [dashboard]);

  return <SidebarAddButton onAdd={onAddFilter} tooltip={t('dashboard.sidebar.filters.add-filter', 'Add filter')} />;
}
