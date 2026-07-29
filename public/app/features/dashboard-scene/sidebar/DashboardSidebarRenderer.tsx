import { css } from '@emotion/css';
import { useCallback, useEffect } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useFlagGlobalDashboardVariables, useFlagGrafanaViewPanelPane } from '@grafana/runtime/internal';
import { sceneGraph, type SceneVariable, useSceneObjectState } from '@grafana/scenes';
import { Sidebar, useStyles2, useSidebarContext } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { type DashboardScene } from '../scene/DashboardScene';
import { onOpenSnapshotOriginalDashboard } from '../scene/GoToSnapshotOriginButton';
import { ManagedDashboardNavBarBadge } from '../scene/ManagedDashboardNavBarBadge';
import { DashboardFiltersOverviewPane } from '../scene/dashboard-filters-overview/DashboardFiltersOverviewPane';
import { type ToolbarActionProps } from '../scene/new-toolbar/types';
import { DashboardInteractions } from '../utils/interactions';
import { dynamicDashNavActions } from '../utils/registerDynamicDashNavAction';

import { DashboardCodePane } from './DashboardCodePane';
import { ShareExportDashboardButton } from './DashboardExportButton';
import { DashboardSidebarExtensionPoint } from './DashboardSidebarExtensionPoint';
import { AddNewEditPane } from './add-new/AddNewEditPane';
import { DashboardPredefinedVariablesPane } from './dashboard/DashboardPredefinedVariablesPane';
import { ToggleViewPanePaneEvent } from './events';
import { DashboardOutline } from './outline/DashboardOutline';
import { type DashboardSidebarLike, type DashboardSidebarPane } from './types';

export interface Props {
  dashboard: DashboardScene;
}

/**
 * Making the Sidebar rendering completely standalone (not using editPane.Component) in order to pass custom react props
 */
export function DashboardSidebarRenderer({ dashboard }: Props) {
  const sidebar = dashboard.state.sidebar;
  const { openPane, selectionContext, outlinePane } = useSceneObjectState(sidebar, {
    shouldActivateOrKeepAlive: true,
  });
  const { isEditing, meta, uid, viewPanel } = dashboard.useState();
  const styles = useStyles2(getStyles, isEditing);
  const hasUid = Boolean(uid);
  const isEmbedded = meta.isEmbedded;
  const selectedObject = sidebar.getSelectedObject();
  const sidebarContext = useSidebarContext();
  const viewPanelPane = useFlagGrafanaViewPanelPane();
  const globalDashboardVariablesEnabled = useFlagGlobalDashboardVariables();
  const onClickHideSidebar: React.MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      sidebar.closePane();
      sidebarContext?.setIsHidden(true);
      e.currentTarget.blur();
    },
    [sidebar, sidebarContext]
  );

  /**
   * Clear selection if the object no longer exists
   */
  useEffect(() => {
    if (!selectedObject && selectionContext.selected.length > 0) {
      sidebar.fixSelectionOfRemovedObject();
      return;
    }
  }, [selectedObject, selectionContext.selected, sidebar]);

  return (
    <>
      {openPane && (
        <Sidebar.OpenPane>
          <openPane.Component key={openPane.state.key} model={openPane} />
        </Sidebar.OpenPane>
      )}
      <Sidebar.Toolbar>
        {isEditing && (
          <div className={styles.editGroup}>
            <Sidebar.Button
              icon="plus"
              variant="primary"
              onClick={() => sidebar.openPane(new AddNewEditPane({}))}
              title={t('dashboard.sidebar.add.title', 'Add')}
              tooltip={t('dashboard.sidebar.add.tooltip', 'Add new element')}
              data-testid={selectors.pages.Dashboard.Sidebar.addButton}
              active={openPane instanceof AddNewEditPane}
            />
            <Sidebar.Button
              icon="cog"
              onClick={() => sidebar.selectObject(dashboard)}
              title={t('dashboard.sidebar.dashboard-options.title', 'Options')}
              tooltip={t('dashboard.sidebar.dashboard-options.tooltip', 'Dashboard options')}
              data-testid={selectors.pages.Dashboard.Sidebar.optionsButton}
              active={selectedObject === dashboard && openPane?.getId() === 'element' ? true : false}
            />
            {config.featureToggles.feedbackButton && (
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
                  'dashboard-scene.dashboard-sidebar-renderer.title-feedback-dashboard-editing-experience',
                  'Give feedback on the new dashboard editing experience'
                )}
                tooltip={t(
                  'dashboard-scene.dashboard-sidebar-renderer.title-feedback-dashboard-editing-experience',
                  'Give feedback on the new dashboard editing experience'
                )}
              />
            )}
            <Sidebar.Button
              tooltip={t('dashboard.sidebar.edit-schema.tooltip', 'Edit as code')}
              title={t('dashboard.sidebar.edit-schema.title', 'Code')}
              icon="brackets-curly"
              onClick={() => sidebar.openPane(new DashboardCodePane({}))}
              active={openPane instanceof DashboardCodePane}
            />
            {globalDashboardVariablesEnabled && (
              <Sidebar.Button
                icon="dollar-alt"
                onClick={() => sidebar.openPane(new DashboardPredefinedVariablesPane({}))}
                title={t('dashboard.sidebar.predefined-variables.title', 'Predefined variables')}
                tooltip={t(
                  'dashboard.sidebar.predefined-variables.tooltip',
                  'Choose which global and folder variables this dashboard receives'
                )}
                active={openPane?.getId() === 'predefined-variables'}
              />
            )}
            {config.featureToggles.dashboardUndoRedo && (
              <>
                <Sidebar.Divider />
                <UndoButton dashboard={dashboard} />
                <RedoButton dashboard={dashboard} />
              </>
            )}
          </div>
        )}
        <div className={styles.viewGroup}>
          {hasUid && !isEmbedded && <ShareExportDashboardButton dashboard={dashboard} />}
          <Sidebar.Button
            icon="list-ui-alt"
            onClick={() => {
              DashboardInteractions.dashboardOutlineClicked();
              sidebar.openPane(outlinePane!);
            }}
            title={t('dashboard.sidebar.outline.title', 'Outline')}
            tooltip={t('dashboard.sidebar.outline.tooltip', 'Content outline')}
            data-testid={selectors.pages.Dashboard.Sidebar.outlineButton}
            active={openPane instanceof DashboardOutline}
          />
          {config.featureToggles.dashboardNewLayouts && config.featureToggles.dashboardUnifiedDrilldownControls && (
            <FiltersOverviewButton sidebar={sidebar} openPane={openPane} />
          )}
          {dashboard.isManaged() && Boolean(meta.canEdit) && <ManagedDashboardNavBarBadge dashboard={dashboard} />}
          {renderEnterpriseItems()}
          <DashboardSidebarExtensionPoint />
          {viewPanel && viewPanelPane && (
            <Sidebar.Button
              icon="layer-group"
              onClick={() => sidebar.publishEvent(new ToggleViewPanePaneEvent())}
              title={t('dashboard.sidebar.view-panel.title', 'View panel controls')}
              data-testid={selectors.pages.Dashboard.Sidebar.viewPanelControls}
              active={openPane?.getId() === 'view-panel-pane'}
            />
          )}
          {Boolean(meta.isSnapshot) && (
            <Sidebar.Button
              data-testid="button-snapshot"
              tooltip={t('dashboard.sidebar.snapshot.tooltip', 'Open original dashboard')}
              title={t('dashboard.toolbar.snapshot.title', 'Source')}
              icon="link"
              onClick={() => onOpenSnapshotOriginalDashboard(dashboard.getSnapshotUrl())}
            />
          )}
          <Sidebar.Divider />
          <Sidebar.Button
            icon={'arrow-to-right'}
            onClick={onClickHideSidebar}
            title={t('grafana-ui.sidebar.hide', 'Hide')}
            data-testid={selectors.components.Sidebar.showHideToggle}
          />
        </div>
      </Sidebar.Toolbar>
    </>
  );
}

function FiltersOverviewButton({
  sidebar,
  openPane,
}: {
  sidebar: DashboardSidebarLike;
  openPane: DashboardSidebarPane | undefined;
}) {
  const variables: SceneVariable[] = sceneGraph.getVariables(sidebar)?.useState().variables ?? [];
  const hasFilters = variables.some((v) => v.state.type === 'adhoc');

  if (!hasFilters) {
    return null;
  }

  return (
    <Sidebar.Button
      icon="filter"
      onClick={() => sidebar.openPane(new DashboardFiltersOverviewPane({}))}
      title={t('dashboard.sidebar.filters', 'Filters')}
      tooltip={t('dashboard.sidebar.open', 'Filters overview')}
      active={openPane instanceof DashboardFiltersOverviewPane}
    />
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
  const sidebar = dashboard.state.sidebar;
  const { undoStack } = sidebar.useState();
  const undoAction = undoStack[undoStack.length - 1];
  const undoWord = t('dashboard.sidebar.undo', 'Undo');
  const tooltip = `${undoWord}${undoAction?.description ? ` ${undoAction.description}` : ''}`;

  return (
    <Sidebar.Button
      icon="corner-up-left"
      disabled={undoStack.length === 0}
      onClick={() => sidebar.undoAction()}
      title={undoWord}
      tooltip={tooltip}
    />
  );
}

function RedoButton({ dashboard }: ToolbarActionProps) {
  const sidebar = dashboard.state.sidebar;
  const { redoStack } = sidebar.useState();
  const redoAction = redoStack[redoStack.length - 1];
  const redoWord = t('dashboard.sidebar.redo', 'Redo');
  const tooltip = `${redoWord}${redoAction?.description ? ` ${redoAction.description}` : ''}`;

  return (
    <Sidebar.Button
      icon="corner-up-right"
      disabled={redoStack.length === 0}
      title={redoWord}
      tooltip={tooltip}
      onClick={() => sidebar.redoAction()}
    />
  );
}

function getStyles(theme: GrafanaTheme2, isEditing: boolean | undefined) {
  return {
    editGroup: css({
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(2),
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      borderTopLeftRadius: theme.shape.radius.default,
      borderTopRightRadius: theme.shape.radius.default,
    }),
    viewGroup: css({
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(2),
      paddingTop: isEditing ? 0 : theme.spacing(1),
    }),
  };
}
