import { useCallback, useMemo, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { sceneGraph, SceneObject, SceneObjectState, sceneUtils, useSceneObjectState } from '@grafana/scenes';
import { Sidebar } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { DashboardScene } from '../scene/DashboardScene';
import { onOpenSnapshotOriginalDashboard } from '../scene/GoToSnapshotOriginButton';
import { ManagedDashboardNavBarBadge } from '../scene/ManagedDashboardNavBarBadge';
import { DashboardFiltersOverviewPane } from '../scene/dashboard-filters-overview/DashboardFiltersOverviewPane';
import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { ToolbarActionProps } from '../scene/new-toolbar/types';
import { dynamicDashNavActions } from '../utils/registerDynamicDashNavAction';
import { getDefaultVizPanel } from '../utils/utils';

import { DashboardEditPane } from './DashboardEditPane';
import { ShareExportDashboardButton } from './DashboardExportButton';
import { DashboardOutline } from './DashboardOutline';
import { ElementEditPane } from './ElementEditPane';
import { AddNewEditPane } from './add-new/AddNewEditPane';

export interface Props {
  editPane: DashboardEditPane;
  dashboard: DashboardScene;
}

/**
 * Making the EditPane rendering completely standalone (not using editPane.Component) in order to pass custom react props
 */
export function DashboardEditPaneRenderer({ editPane, dashboard }: Props) {
  const { selection, openPane } = useSceneObjectState(editPane, { shouldActivateOrKeepAlive: true });
  const { isEditing, meta, uid } = dashboard.useState();
  const hasUid = Boolean(uid);
  const isEmbedded = meta.isEmbedded;
  const selectedObject = selection?.getFirstObject();
  const isNewElement = selection?.isNewElement() ?? false;
  // the layout element that was selected when opening the 'add' pane
  // used when adding new panel from the sidebar
  const [selectedLayoutElement, setSelectedLayoutElement] = useState<DashboardScene | SceneObject<SceneObjectState>>(
    dashboard
  );

  const editableElement = useMemo(() => {
    if (selection) {
      return selection.createSelectionElement();
    }

    return undefined;
  }, [selection]);

  const { variables } = sceneGraph.getVariables(dashboard)?.useState() ?? { variables: [] };
  const adHocVar = variables.find((v) => sceneUtils.isAdHocVariable(v));
  const groupByVar = variables.find((v) => sceneUtils.isGroupByVariable(v));

  const onSetLayoutElement = useCallback(
    (obj: SceneObject<SceneObjectState> | undefined) => {
      if (obj) {
        // find the closest row or tab to add the new panel to
        // if the selected element is not inside a row or tab, add to dashboard root
        setSelectedLayoutElement(
          sceneGraph.findObject(
            obj,
            (currentSceneObject: SceneObject<SceneObjectState>) =>
              currentSceneObject instanceof RowItem || currentSceneObject instanceof TabItem
          ) || dashboard
        );
      } else {
        setSelectedLayoutElement(dashboard);
      }
    },
    [dashboard]
  );

  const onAddNewPanel = useCallback(() => {
    if (selectedLayoutElement) {
      const panel = getDefaultVizPanel();
      if (selectedLayoutElement instanceof DashboardScene) {
        dashboard.addPanel(panel);
      } else if (selectedLayoutElement instanceof RowItem || selectedLayoutElement instanceof TabItem) {
        selectedLayoutElement.getLayout().addPanel(panel);
      }
    }
  }, [dashboard, selectedLayoutElement]);

  return (
    <>
      {editableElement && (
        <Sidebar.OpenPane>
          <ElementEditPane
            key={selectedObject?.state.key}
            editPane={editPane}
            element={editableElement}
            isNewElement={isNewElement}
          />
        </Sidebar.OpenPane>
      )}
      {openPane === 'add' && (
        <Sidebar.OpenPane>
          <AddNewEditPane onAddPanel={onAddNewPanel} dashboard={dashboard} selectedElement={selectedLayoutElement} />
        </Sidebar.OpenPane>
      )}
      {openPane === 'outline' && (
        <Sidebar.OpenPane>
          <DashboardOutline editPane={editPane} isEditing={isEditing} />
        </Sidebar.OpenPane>
      )}
      {openPane === 'filters' && (
        <Sidebar.OpenPane>
          <DashboardFiltersOverviewPane
            adhocFilters={adHocVar}
            groupByVariable={groupByVar}
            onClose={() => editPane.closePane()}
          />
        </Sidebar.OpenPane>
      )}
      <Sidebar.Toolbar>
        {isEditing && (
          <>
            <Sidebar.Button
              icon="plus"
              variant="primary"
              onClick={() => {
                onSetLayoutElement(selectedObject);
                editPane.openPane('add');
              }}
              title={t('dashboard.sidebar.add.title', 'Add')}
              tooltip={t('dashboard.sidebar.add.tooltip', 'Add new element')}
              data-testid={selectors.pages.Dashboard.Sidebar.addButton}
              active={selectedObject === null || openPane === 'add'}
            />

            <Sidebar.Button
              icon="cog"
              onClick={() => editPane.selectObject(dashboard, dashboard.state.key!)}
              title={t('dashboard.sidebar.dashboard-options.title', 'Options')}
              tooltip={t('dashboard.sidebar.dashboard-options.tooltip', 'Dashboard options')}
              data-testid={selectors.pages.Dashboard.Sidebar.optionsButton}
              active={selectedObject === dashboard ? true : false}
            />
            <Sidebar.Button
              style={{ color: '#ff671d' }}
              icon="comment-alt-message"
              onClick={() =>
                window.open(
                  'https://docs.google.com/forms/d/e/1FAIpQLSfDZJM_VlZgRHDx8UPtLWbd9bIBPRxoA28qynTHEYniyPXO6Q/viewform',
                  '_blank'
                )
              }
              title={t(
                'dashboard-scene.dashboard-edit-pane-renderer.title-feedback-dashboard-editing-experience',
                'Give feedback on the new dashboard editing experience'
              )}
              tooltip={t(
                'dashboard-scene.dashboard-edit-pane-renderer.title-feedback-dashboard-editing-experience',
                'Give feedback on the new dashboard editing experience'
              )}
            />
            {config.featureToggles.dashboardUndoRedo && (
              <>
                <Sidebar.Divider />
                <UndoButton dashboard={dashboard} />
                <RedoButton dashboard={dashboard} />
                <Sidebar.Divider />
              </>
            )}
          </>
        )}
        {hasUid && !isEmbedded && <ShareExportDashboardButton dashboard={dashboard} />}
        <Sidebar.Button
          icon="list-ui-alt"
          onClick={() => editPane.openPane('outline')}
          title={t('dashboard.sidebar.outline.title', 'Outline')}
          tooltip={t('dashboard.sidebar.outline.tooltip', 'Content outline')}
          data-testid={selectors.pages.Dashboard.Sidebar.outlineButton}
          active={openPane === 'outline'}
        ></Sidebar.Button>
        {config.featureToggles.dashboardNewLayouts && config.featureToggles.dashboardFiltersOverview && adHocVar && (
          <Sidebar.Button
            icon="filter"
            onClick={() => editPane.openPane('filters')}
            title={t('dashboards.filters-overview.filters', 'Filters')}
            tooltip={t('dashboards.filters-overview.open', 'Open filters overview pane')}
            active={openPane === 'filters'}
          />
        )}
        {dashboard.isManaged() && Boolean(meta.canEdit) && <ManagedDashboardNavBarBadge dashboard={dashboard} />}
        {renderEnterpriseItems()}
        {Boolean(meta.isSnapshot) && (
          <Sidebar.Button
            data-testid="button-snapshot"
            tooltip={t('dashboard.sidebar.snapshot.tooltip', 'Open original dashboard')}
            title={t('dashboard.toolbar.snapshot.title', 'Source')}
            icon="link"
            onClick={() => onOpenSnapshotOriginalDashboard(dashboard.getSnapshotUrl())}
          />
        )}
      </Sidebar.Toolbar>
    </>
  );
}

function renderEnterpriseItems() {
  const dashboard = getDashboardSrv().getCurrent()!;
  const showProps = { dashboard };

  return dynamicDashNavActions.right.map((action, index) => {
    if (action.show(showProps)) {
      const ActionComponent = action.component;
      return <ActionComponent key={index} dashboard={dashboard} />;
    }
    return null;
  });
}

function UndoButton({ dashboard }: ToolbarActionProps) {
  const editPane = dashboard.state.editPane;
  const { undoStack } = editPane.useState();
  const undoAction = undoStack[undoStack.length - 1];
  const undoWord = t('dashboard.sidebar.undo', 'Undo');
  const tooltip = `${undoWord}${undoAction?.description ? ` ${undoAction.description}` : ''}`;

  return (
    <Sidebar.Button
      icon="corner-up-left"
      disabled={undoStack.length === 0}
      onClick={() => editPane.undoAction()}
      title={undoWord}
      tooltip={tooltip}
    />
  );
}

function RedoButton({ dashboard }: ToolbarActionProps) {
  const editPane = dashboard.state.editPane;
  const { redoStack } = editPane.useState();
  const redoAction = redoStack[redoStack.length - 1];
  const redoWord = t('dashboard.sidebar.redo', 'Redo');
  const tooltip = `${redoWord}${redoAction?.description ? ` ${redoAction.description}` : ''}`;

  return (
    <Sidebar.Button
      icon="corner-up-right"
      disabled={redoStack.length === 0}
      title={redoWord}
      tooltip={tooltip}
      onClick={() => editPane.redoAction()}
    />
  );
}
