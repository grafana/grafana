import { css } from '@emotion/css';
import { useCallback, useEffect } from 'react';
import { useMedia } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { sceneGraph, type SceneVariable, useSceneObjectState } from '@grafana/scenes';
import { Sidebar, useStyles2, useSidebarContext, useTheme2 } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { type DashboardScene } from '../scene/DashboardScene';
import { onOpenSnapshotOriginalDashboard } from '../scene/GoToSnapshotOriginButton';
import { ManagedDashboardNavBarBadge } from '../scene/ManagedDashboardNavBarBadge';
import { DashboardFiltersOverviewPane } from '../scene/dashboard-filters-overview/DashboardFiltersOverviewPane';
import { type ToolbarActionProps } from '../scene/new-toolbar/types';
import { dynamicDashNavActions } from '../utils/registerDynamicDashNavAction';

import { DashboardCodePane } from './DashboardCodePane';
import { type DashboardEditPane } from './DashboardEditPane';
import { ShareExportDashboardButton } from './DashboardExportButton';
import { DashboardOutline } from './DashboardOutline';
import { AddNewEditPane } from './add-new/AddNewEditPane';
import { type DashboardSidebarPane } from './types';
import { DashboardInteractions } from '../utils/interactions';

export interface Props {
  editPane: DashboardEditPane;
  dashboard: DashboardScene;
}

/**
 * Making the EditPane rendering completely standalone (not using editPane.Component) in order to pass custom react props
 */
export function DashboardEditPaneRenderer({ editPane, dashboard }: Props) {
  const { openPane, selectionContext } = useSceneObjectState(editPane, {
    shouldActivateOrKeepAlive: true,
  });
  const { isEditing, meta, uid } = dashboard.useState();
  const styles = useStyles2(getStyles, isEditing);
  const hasUid = Boolean(uid);
  const isEmbedded = meta.isEmbedded;
  const selectedObject = editPane.getSelectedObject();
  const theme = useTheme2();
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.values.sm}px)`);
  const sidebarContext = useSidebarContext();
  const onClickHideSidebar: React.MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      sidebarContext?.onToggleIsHidden();
      e.currentTarget.blur();
    },
    [sidebarContext]
  );

  /**
   * Clear selection if the object no longer exists
   */
  useEffect(() => {
    if (!selectedObject && selectionContext.selected.length > 0) {
      editPane.clearSelection();
      return;
    }
  }, [selectedObject, selectionContext.selected, editPane]);

  return (
    <>
      {openPane && <Sidebar.OpenPane>{openPane && <openPane.Component model={openPane} />}</Sidebar.OpenPane>}
      <Sidebar.Toolbar>
        {isEditing && (
          <div className={styles.editGroup}>
            <Sidebar.Button
              icon="plus"
              variant="primary"
              onClick={() => editPane.openPane(new AddNewEditPane({}))}
              title={t('dashboard.sidebar.add.title', 'Add')}
              tooltip={t('dashboard.sidebar.add.tooltip', 'Add new element')}
              data-testid={selectors.pages.Dashboard.Sidebar.addButton}
              active={openPane instanceof AddNewEditPane}
            />

            <Sidebar.Button
              icon="cog"
              onClick={() => editPane.selectObject(dashboard)}
              title={t('dashboard.sidebar.dashboard-options.title', 'Options')}
              tooltip={t('dashboard.sidebar.dashboard-options.tooltip', 'Dashboard options')}
              data-testid={selectors.pages.Dashboard.Sidebar.optionsButton}
              active={selectedObject === dashboard ? true : false}
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
                  'dashboard-scene.dashboard-edit-pane-renderer.title-feedback-dashboard-editing-experience',
                  'Give feedback on the new dashboard editing experience'
                )}
                tooltip={t(
                  'dashboard-scene.dashboard-edit-pane-renderer.title-feedback-dashboard-editing-experience',
                  'Give feedback on the new dashboard editing experience'
                )}
              />
            )}
            <Sidebar.Button
              tooltip={t('dashboard.sidebar.edit-schema.tooltip', 'Edit as code')}
              title={t('dashboard.sidebar.edit-schema.title', 'Code')}
              icon="brackets-curly"
              onClick={() => editPane.openPane(new DashboardCodePane({}))}
              active={openPane instanceof DashboardCodePane}
            />
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
              editPane.openPane(new DashboardOutline({}));
            }}
            title={t('dashboard.sidebar.outline.title', 'Outline')}
            tooltip={t('dashboard.sidebar.outline.tooltip', 'Content outline')}
            data-testid={selectors.pages.Dashboard.Sidebar.outlineButton}
            active={openPane instanceof DashboardOutline}
          />
          {config.featureToggles.dashboardNewLayouts &&
            (config.featureToggles.dashboardFiltersOverview ||
              config.featureToggles.dashboardUnifiedDrilldownControls) && (
              <FiltersOverviewButton editPane={editPane} openPane={openPane} />
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
          {isMobile && !isEditing && (
            <>
              <Sidebar.Divider />
              <Sidebar.Button
                icon={'arrow-to-right'}
                onClick={onClickHideSidebar}
                title={t('grafana-ui.sidebar.hide', 'Hide')}
                data-testid={selectors.components.Sidebar.showHideToggle}
              />
            </>
          )}
        </div>
      </Sidebar.Toolbar>
    </>
  );
}

function FiltersOverviewButton({
  editPane,
  openPane,
}: {
  editPane: DashboardEditPane;
  openPane: DashboardSidebarPane | undefined;
}) {
  const variables: SceneVariable[] = sceneGraph.getVariables(editPane)?.useState().variables ?? [];
  const hasFilters = variables.some((v) => v.state.type === 'adhoc');

  if (!hasFilters) {
    return null;
  }

  return (
    <Sidebar.Button
      icon="filter"
      onClick={() => editPane.openPane(new DashboardFiltersOverviewPane({}))}
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
