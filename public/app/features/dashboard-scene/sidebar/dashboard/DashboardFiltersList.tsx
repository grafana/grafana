import { useCallback, useMemo } from 'react';

import { VariableHide } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagGrafanaDashboardGlobalVariables } from '@grafana/runtime/internal';
import { type SceneVariableSet, type SceneVariable } from '@grafana/scenes';
import { useDragAndDrop } from '@grafana/ui/internal';

import { duplicateVariable } from '../../actions/variable/duplicateVariable';
import { type DashboardScene } from '../../scene/DashboardScene';
import { openAddFilterTypePane } from '../../settings/variables/VariableTypeSelectionPane';
import { DashboardInteractions } from '../../utils/interactions';
import { openAddFilterForm } from '../add-new/AddFilters';

import { DraggableList } from './DraggableList';
import { ReadOnlyVariableRows } from './ReadOnlyVariableGroup';
import { SidebarAddButton } from './SidebarAddButton';
import { selectSidebarObject, toDraggableListItemActions } from './helpers';
import { groupSidebarVariablesByDisplay, isFilterOrGroupByVariable } from './partitionSidebarVariables';
import { confirmDeleteVariable, createDragEndHandler } from './variableListActions';

const ID_FILTERS_VISIBLE_LIST = 'filters-list-visible';
const ID_FILTERS_CONTROLS_MENU_LIST = 'filters-list-controls-menu';
const ID_FILTERS_HIDDEN_LIST = 'filters-list-hidden';

const DROPPABLE_TO_HIDE: Record<string, VariableHide> = {
  [ID_FILTERS_VISIBLE_LIST]: VariableHide.dontHide,
  [ID_FILTERS_CONTROLS_MENU_LIST]: VariableHide.inControlsMenu,
  [ID_FILTERS_HIDDEN_LIST]: VariableHide.hideVariable,
};

export function DashboardFiltersList({
  variableSet,
  includePredefined = false,
}: {
  variableSet: SceneVariableSet;
  includePredefined?: boolean;
}) {
  const { DragDropContext } = useDragAndDrop();
  const { variables } = variableSet.useState();
  const { visible, controlsMenu, hidden } = useMemo(
    () =>
      groupSidebarVariablesByDisplay(variables.filter(isFilterOrGroupByVariable), {
        includePredefined,
        excludeFilters: false,
      }),
    [includePredefined, variables]
  );

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
        visible.editable,
        controlsMenu.editable,
        hidden.editable,
        t('dashboard.sidebar.filters.reorder-description', 'Reorder filters list'),
        DROPPABLE_TO_HIDE
      ),
    [variableSet, visible.editable, controlsMenu.editable, hidden.editable]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <DraggableList
        items={visible.editable}
        droppableId={ID_FILTERS_VISIBLE_LIST}
        title={t('dashboard.sidebar.filters.title-above-dashboard', 'Above dashboard')}
        renderItemLabel={renderItemLabel}
        leading={<ReadOnlyVariableRows variables={visible.readOnly} itemTestId="filter-name" />}
        itemsCount={visible.editable.length + visible.readOnly.length}
        {...filterActions}
      />
      <DraggableList
        items={controlsMenu.editable}
        droppableId={ID_FILTERS_CONTROLS_MENU_LIST}
        title={t('dashboard.sidebar.filters.title-controls-menu', 'Controls menu')}
        renderItemLabel={renderItemLabel}
        leading={<ReadOnlyVariableRows variables={controlsMenu.readOnly} itemTestId="filter-name" />}
        itemsCount={controlsMenu.editable.length + controlsMenu.readOnly.length}
        {...filterActions}
      />
      <DraggableList
        items={hidden.editable}
        droppableId={ID_FILTERS_HIDDEN_LIST}
        title={t('dashboard.sidebar.filters.title-hidden', 'Hidden')}
        renderItemLabel={renderItemLabel}
        leading={<ReadOnlyVariableRows variables={hidden.readOnly} itemTestId="filter-name" />}
        itemsCount={hidden.editable.length + hidden.readOnly.length}
        {...filterActions}
      />
    </DragDropContext>
  );
}

const renderItemLabel = (v: SceneVariable) => <span data-testid="filter-name">{v.state.name}</span>;

export function AddFilterIconButton({ dashboard }: { dashboard: DashboardScene }) {
  const globalVariablesEnabled = useFlagGrafanaDashboardGlobalVariables();
  const onAddFilter = useCallback(() => {
    if (globalVariablesEnabled) {
      openAddFilterTypePane(dashboard);
    } else {
      void openAddFilterForm(dashboard, dashboard);
    }
    DashboardInteractions.addFilterButtonClicked({ source: 'edit_pane' });
  }, [dashboard, globalVariablesEnabled]);

  return <SidebarAddButton onAdd={onAddFilter} tooltip={t('dashboard.sidebar.filters.add-filter', 'Add filter')} />;
}
