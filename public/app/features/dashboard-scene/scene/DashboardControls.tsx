import { css, cx } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2, VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import {
  type SceneObjectState,
  SceneObjectBase,
  type SceneComponentProps,
  SceneTimePicker,
  SceneRefreshPicker,
  SceneDebugger,
  VariableDependencyConfig,
  sceneGraph,
  SceneObjectUrlSyncConfig,
  type SceneObjectUrlValues,
  type CancelActivationHandler,
  type SceneObject,
  type SceneVariable,
  SceneVariableSet,
} from '@grafana/scenes';
import { Box, Button, ButtonGroup, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { contextSrv } from 'app/core/services/context_srv';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
import { ContextualNavigationPaneToggle } from 'app/features/scopes/dashboards/ContextualNavigationPaneToggle';
import { KioskMode } from 'app/types/dashboard';

import { PanelEditControls } from '../panel-edit/PanelEditControls';
import { type PanelEditor } from '../panel-edit/PanelEditor';
import { usePanelEditDirty } from '../panel-edit/usePanelEditDirty';
import { findVizPanelByPathId } from '../utils/pathId';
import { getDashboardSceneFor, isLibraryPanel } from '../utils/utils';
import { filterSectionRepeatLocalVariables } from '../variables/utils';

import { DashboardDataLayerControls } from './DashboardDataLayerControls';
import { DashboardLinksControls } from './DashboardLinksControls';
import { type DashboardScene } from './DashboardScene';
import { VariableControls } from './VariableControls';
import { DashboardControlsButton } from './dashboard-controls-menu/DashboardControlsMenuButton';
import { hasDashboardControls, useHasDashboardControls } from './dashboard-controls-menu/utils';
import { DashboardFiltersOverviewPaneToggle } from './dashboard-filters-overview/DashboardFiltersOverviewPaneToggle';
import { EditDashboardSwitch } from './new-toolbar/actions/EditDashboardSwitch';
import { MakeDashboardEditableButton } from './new-toolbar/actions/MakeDashboardEditableButton';
import { SaveDashboard } from './new-toolbar/actions/SaveDashboard';
import { ShareDashboardButton } from './new-toolbar/actions/ShareDashboardButton';
import { type ToolbarActionProps } from './new-toolbar/types';

function getPanelEditVariables(
  dashboard: DashboardScene,
  sectionVariablesEnabled: boolean
): SceneVariable[] | undefined {
  if (!sectionVariablesEnabled) {
    return undefined;
  }

  const viewPanelKey = dashboard.state.viewPanel;
  const panel =
    dashboard.state.editPanel?.state.panelRef?.resolve() ??
    (viewPanelKey ? findVizPanelByPathId(dashboard, viewPanelKey) : null) ??
    undefined;

  if (!panel) {
    return undefined;
  }

  const result: SceneVariable[] = [];
  const seenNames = new Set<string>();
  let current: SceneObject | undefined = panel.parent ?? panel;

  while (current) {
    if (current.state.$variables instanceof SceneVariableSet) {
      const variables = filterSectionRepeatLocalVariables(
        current.state.$variables.state.variables,
        current.state.$variables
      );

      for (const variable of variables) {
        const name = variable.state.name;
        if (!seenNames.has(name)) {
          seenNames.add(name);
          result.push(variable);
        }
      }
    }
    current = current.parent;
  }

  return result;
}

export interface DashboardControlsState extends SceneObjectState {
  timePicker: SceneTimePicker;
  refreshPicker: SceneRefreshPicker;
  hideTimeControls?: boolean;
  hideVariableControls?: boolean;
  hideLinksControls?: boolean;
  // Hides the dashboard-controls dropdown menu
  hideDashboardControls?: boolean;
  hidePlaylistNav?: boolean;
}

export class DashboardControls extends SceneObjectBase<DashboardControlsState> {
  static Component = DashboardControlsRenderer;

  protected _variableDependency = new VariableDependencyConfig(this, {
    onAnyVariableChanged: this._onAnyVariableChanged.bind(this),
  });

  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: [
      '_dash.hideTimePicker',
      '_dash.hideVariables',
      '_dash.hideLinks',
      '_dash.hideDashboardControls',
      '_dash.hidePlaylistNav',
    ],
  });

  /**
   * We want the hideXX url keys to only sync one way (url => state) on init
   * We don't want these flags to be added to URL.
   */
  getUrlState() {
    return {};
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const { hideTimeControls, hideVariableControls, hideLinksControls, hideDashboardControls, hidePlaylistNav } =
      this.state;
    const isEnabledViaUrl = (key: string) => values[key] === 'true' || values[key] === '';

    if (!hideTimeControls && isEnabledViaUrl('_dash.hideTimePicker')) {
      this.setState({ hideTimeControls: true });
    }

    if (!hideVariableControls && isEnabledViaUrl('_dash.hideVariables')) {
      this.setState({ hideVariableControls: true });
    }

    if (!hideLinksControls && isEnabledViaUrl('_dash.hideLinks')) {
      this.setState({ hideLinksControls: true });
    }

    if (!hideDashboardControls && isEnabledViaUrl('_dash.hideDashboardControls')) {
      this.setState({ hideDashboardControls: true });
    }

    if (!hidePlaylistNav && isEnabledViaUrl('_dash.hidePlaylistNav')) {
      this.setState({ hidePlaylistNav: true });
    }
  }

  public constructor(state: Partial<DashboardControlsState>) {
    super({
      timePicker: state.timePicker ?? new SceneTimePicker({}),
      refreshPicker: state.refreshPicker ?? new SceneRefreshPicker({}),
      ...state,
    });

    this.addActivationHandler(() => {
      let refreshPickerDeactivation: CancelActivationHandler | undefined;

      if (this.state.hideTimeControls) {
        refreshPickerDeactivation = this.state.refreshPicker.activate();
      }

      return () => {
        if (refreshPickerDeactivation) {
          refreshPickerDeactivation();
        }
      };
    });
  }

  /**
   * Links can include all variables so we need to re-render when any change
   */
  private _onAnyVariableChanged(): void {
    const dashboard = getDashboardSceneFor(this);
    if (dashboard.state.links?.length > 0) {
      this.forceRender();
    }
  }

  public hasControls(): boolean {
    const dashboard = getDashboardSceneFor(this);
    // OpenFeature is not initialized for anonymous users, so fall back to
    // the static feature toggle to ensure section variables work without auth.
    const sectionVariablesEnabled = getFeatureFlagClient().getBooleanValue(
      FlagKeys.DashboardSectionVariables,
      Boolean(config.featureToggles.dashboardSectionVariables)
    );
    const panelEditVariables = getPanelEditVariables(dashboard, sectionVariablesEnabled);
    const variables = panelEditVariables ?? sceneGraph.getVariables(this)?.state.variables ?? [];
    const hasVariables = variables.some((v) => v.state.hide !== VariableHide.hideVariable);
    const hasAnnotations = sceneGraph.getDataLayers(this).some((d) => d.state.isEnabled && !d.state.isHidden);
    const hasLinks = getDashboardSceneFor(this).state.links?.length > 0;
    const hideLinks = this.state.hideLinksControls || !hasLinks;
    const hideVariables = this.state.hideVariableControls || (!hasAnnotations && !hasVariables);
    const hideTimePicker = this.state.hideTimeControls;
    const hideDashboardControls = this.state.hideDashboardControls || !hasDashboardControls(dashboard);

    return !(hideVariables && hideLinks && hideTimePicker && hideDashboardControls);
  }
}

function DashboardControlsRenderer({ model }: SceneComponentProps<DashboardControls>) {
  const {
    refreshPicker,
    timePicker,
    hideTimeControls,
    hideVariableControls,
    hideLinksControls,
    hideDashboardControls,
    hidePlaylistNav,
  } = model.useState();

  const dashboard = getDashboardSceneFor(model);
  const { links, editPanel } = dashboard.useState();
  const styles = useStyles2(getStyles);
  const showDebugger = window.location.search.includes('scene-debugger');
  const hasDashboardControls = useHasDashboardControls(dashboard);
  // OpenFeature is not initialized for anonymous users, so fall back to
  // the static feature toggle to ensure section variables work without auth.
  const sectionVariablesEnabled = getFeatureFlagClient().getBooleanValue(
    FlagKeys.DashboardSectionVariables,
    Boolean(config.featureToggles.dashboardSectionVariables)
  );
  const panelEditVariables = getPanelEditVariables(dashboard, sectionVariablesEnabled);
  const { chrome } = useGrafana();
  const { kioskMode } = chrome.useState();

  if (!model.hasControls()) {
    // The controls row hosts the dashboard action buttons (with new layouts) and the panel edit
    // actions, so it must render even when the dashboard itself contributes no other controls.
    // DashboardControlActions handles the per-button visibility, including the edit-panel cases.
    if ((config.featureToggles.dashboardNewLayouts || editPanel) && kioskMode !== KioskMode.Full) {
      return (
        <>
          <div data-testid={selectors.pages.Dashboard.Controls} className={styles.controls}>
            {!hideVariableControls && <VariableControls dashboard={dashboard} />}
            <div className={cx(styles.rightControls, editPanel && styles.rightControlsWrap)}>
              <div className={styles.fixedControls}>
                <DashboardControlActions dashboard={dashboard} hidePlaylistNav={hidePlaylistNav} />
              </div>
            </div>
            {editPanel && <PanelEditControls panelEditor={editPanel} />}
          </div>
          <RenderHiddenVariables dashboard={dashboard} />
        </>
      );
    }

    // To still have spacing when no controls are rendered. Panel edit keeps its controls here too,
    // for the cases the full row above is suppressed (e.g. kiosk mode).
    return (
      <Box padding={1}>
        <RenderHiddenVariables dashboard={dashboard} />
        {editPanel && <PanelEditControls panelEditor={editPanel} />}
      </Box>
    );
  }

  return (
    <div data-testid={selectors.pages.Dashboard.Controls} className={styles.controls}>
      <div className={cx(styles.rightControls, editPanel && styles.rightControlsWrap)}>
        {!hideTimeControls && (
          <div className={styles.fixedControls}>
            <timePicker.Component model={timePicker} />
            <refreshPicker.Component model={refreshPicker} />
          </div>
        )}
        {(config.featureToggles.dashboardNewLayouts || editPanel) && (
          <div className={styles.fixedControls}>
            <DashboardControlActions dashboard={dashboard} hidePlaylistNav={hidePlaylistNav} />
          </div>
        )}
        {(config.featureToggles.dashboardFiltersOverview || config.featureToggles.dashboardUnifiedDrilldownControls) &&
          !config.featureToggles.dashboardNewLayouts && (
            <div className={styles.fixedControls}>
              <DashboardFiltersOverviewPaneToggle dashboard={dashboard} />
            </div>
          )}
      </div>
      {config.featureToggles.scopeFilters && !editPanel && (
        <ContextualNavigationPaneToggle className={styles.contextualNavToggle} hideWhenOpen={true} />
      )}
      {!hideVariableControls && (
        <>
          <VariableControls dashboard={dashboard} variablesOverride={panelEditVariables} />
          <DashboardDataLayerControls dashboard={dashboard} />
        </>
      )}
      {!hideLinksControls && !editPanel && <DashboardLinksControls links={links} dashboard={dashboard} />}
      {!hideDashboardControls && hasDashboardControls && <DashboardControlsButton dashboard={dashboard} />}
      <DefaultControlsLoadingSkeleton
        dashboard={dashboard}
        hideVariableControls={hideVariableControls}
        hideLinksControls={hideLinksControls}
      />
      {editPanel && <PanelEditControls panelEditor={editPanel} />}
      {showDebugger && <SceneDebugger scene={model} key={'scene-debugger'} />}
    </div>
  );
}

function DashboardControlActions({
  dashboard,
  hidePlaylistNav,
}: {
  dashboard: DashboardScene;
  hidePlaylistNav?: boolean;
}) {
  const { isEditing, editPanel, uid, meta, editable } = dashboard.useState();
  const { isPlaying } = playlistSrv.useState();
  const { chrome } = useGrafana();
  const { kioskMode } = chrome.useState();

  if (kioskMode === KioskMode.Full) {
    return null;
  }

  const canEditDashboard = dashboard.canEditDashboard();
  const canSave = Boolean(meta.canSave);
  const canSaveAs = contextSrv.hasEditPermissionInFolders;

  const hasUid = Boolean(uid); // isNew
  const isSnapshot = Boolean(meta.isSnapshot);
  const isEmbedded = meta.isEmbedded;
  const isEditable = Boolean(editable);
  const isEditingLibraryPanel = Boolean(editPanel && isLibraryPanel(editPanel.state.panelRef.resolve()));

  const showShareButton = hasUid && !isSnapshot && !isEmbedded && !isPlaying;
  const showSaveButton = isEditing && (canSave || canSaveAs) && !isEditingLibraryPanel;
  const showEditButton = hasUid && !isPlaying && canEditDashboard && isEditable && !editPanel;
  const showMakeEditableButton = !isPlaying && canEditDashboard && !isEditable && !isEditing;
  const showPanelEditButtons = Boolean(editPanel);

  return (
    <>
      {showShareButton && <ShareDashboardButton dashboard={dashboard} />}
      {showSaveButton && <SaveDashboard dashboard={dashboard} />}
      {showEditButton && <EditDashboardSwitch dashboard={dashboard} />}
      {showMakeEditableButton && <MakeDashboardEditableButton dashboard={dashboard} />}
      {showPanelEditButtons && <PanelEditButtons dashboard={dashboard} />}
      {isPlaying && (
        <ButtonGroup>
          {!hidePlaylistNav && (
            <Button
              variant="secondary"
              data-testid={selectors.pages.Dashboard.DashNav.playlistControls.prev}
              tooltip={t('dashboard.toolbar.new.playlist-previous', 'Go to previous dashboard')}
              icon="backward"
              onClick={() => playlistSrv.prev()}
            />
          )}
          <Button
            variant="secondary"
            onClick={() => playlistSrv.stop()}
            data-testid={selectors.pages.Dashboard.DashNav.playlistControls.stop}
          >
            <Trans i18nKey="dashboard.toolbar.new.playlist-stop">Stop playlist</Trans>
          </Button>
          {!hidePlaylistNav && (
            <Button
              variant="secondary"
              data-testid={selectors.pages.Dashboard.DashNav.playlistControls.next}
              tooltip={t('dashboard.toolbar.new.playlist-next', 'Go to next dashboard')}
              icon="forward"
              onClick={() => playlistSrv.next()}
            />
          )}
        </ButtonGroup>
      )}
    </>
  );
}

function PanelEditButtons({ dashboard }: ToolbarActionProps) {
  const { editPanel } = dashboard.useState();

  if (!editPanel) {
    return null;
  }

  return <PanelEditButtonsContent editPanel={editPanel} />;
}

function PanelEditButtonsContent({ editPanel }: { editPanel: PanelEditor }) {
  const isEditedPanelDirty = usePanelEditDirty(editPanel);
  const panel = editPanel.state.panelRef.resolve();
  // Subscribe to the panel so unlinking a library panel (which removes the library behavior) swaps
  // the library actions back to the regular discard/back set without needing an unrelated re-render.
  panel.useState();

  // Library panels have their own set of actions (the changes are saved to the shared library
  // panel rather than the dashboard), so they replace the regular discard/back buttons.
  if (isLibraryPanel(panel)) {
    return <LibraryPanelEditButtons editPanel={editPanel} />;
  }

  return (
    <>
      <Button
        tooltip={t('dashboard.toolbar.panel-edit-discard-tooltip', 'Discard panel changes')}
        data-testid={selectors.components.NavToolbar.editDashboard.discardChangesButton}
        disabled={!isEditedPanelDirty}
        fill="outline"
        variant="destructive"
        onClick={editPanel.onDiscard}
      >
        <Trans i18nKey="dashboard.toolbar.panel-edit-discard">Discard</Trans>
      </Button>
      <Button
        tooltip={t('dashboard.toolbar.panel-edit-back-tooltip', 'Back to dashboard view')}
        data-testid={selectors.components.NavToolbar.editDashboard.backToDashboardButton}
        icon="arrow-left"
        variant="secondary"
        onClick={() => {
          locationService.partial({ viewPanel: null, editPanel: null });
        }}
      >
        <Trans i18nKey="dashboard.toolbar.panel-edit-back">Back</Trans>
      </Button>
    </>
  );
}

function LibraryPanelEditButtons({ editPanel }: { editPanel: PanelEditor }) {
  return (
    <>
      <Button
        onClick={editPanel.onDiscard}
        tooltip={t('dashboard.toolbar.discard-library-panel-changes', 'Discard library panel changes')}
        data-testid={selectors.components.NavToolbar.editDashboard.discardChangesButton}
        fill="outline"
        variant="destructive"
      >
        <Trans i18nKey="dashboard.toolbar.discard-library-panel-changes-short">Discard</Trans>
      </Button>
      <Button
        onClick={editPanel.onUnlinkLibraryPanel}
        tooltip={t('dashboard.toolbar.unlink-library-panel', 'Unlink library panel')}
        data-testid={selectors.components.NavToolbar.editDashboard.unlinkLibraryPanelButton}
        fill="outline"
        variant="secondary"
      >
        <Trans i18nKey="dashboard.toolbar.unlink-library-panel-short">Unlink</Trans>
      </Button>
      <Button
        onClick={editPanel.onSaveLibraryPanel}
        tooltip={t('dashboard.toolbar.save-library-panel', 'Save library panel')}
        data-testid={selectors.components.NavToolbar.editDashboard.saveLibraryPanelButton}
        variant="primary"
      >
        <Trans i18nKey="dashboard.toolbar.save-library-panel-short">Save</Trans>
      </Button>
    </>
  );
}

function RenderHiddenVariables({ dashboard }: { dashboard: DashboardScene }) {
  const { variables } = sceneGraph.getVariables(dashboard).useState();
  const renderAsHiddenVariables = variables.filter((v) => v.UNSAFE_renderAsHidden);
  if (renderAsHiddenVariables && renderAsHiddenVariables.length > 0) {
    return (
      <>
        {renderAsHiddenVariables.map((v) => (
          <v.Component model={v} key={v.state.key} />
        ))}
      </>
    );
  }
  return null;
}

function DefaultControlsLoadingSkeleton({
  dashboard,
  hideVariableControls,
  hideLinksControls,
}: {
  dashboard: DashboardScene;
  hideVariableControls?: boolean;
  hideLinksControls?: boolean;
}) {
  const { defaultVariablesLoading, defaultLinksLoading } = dashboard.useState();
  const styles = useStyles2(getSkeletonStyles);

  const showVariablesSkeleton = defaultVariablesLoading && !hideVariableControls;
  const showLinksSkeleton = defaultLinksLoading && !hideLinksControls;

  if (!showVariablesSkeleton && !showLinksSkeleton) {
    return null;
  }

  return <Skeleton width={60} height={32} containerClassName={styles.skeletonContainer} />;
}

const getSkeletonStyles = (theme: GrafanaTheme2) => ({
  skeletonContainer: css({
    display: 'inline-flex',
    lineHeight: 1,
    verticalAlign: 'middle',
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  }),
});

function getStyles(theme: GrafanaTheme2) {
  return {
    // Original controls style
    controls: css({
      gap: theme.spacing(1),
      padding: theme.spacing(2, 2, 1, 2),
      flexDirection: 'row',
      flexWrap: 'nowrap',
      position: 'relative',
      width: '100%',
      marginLeft: 'auto',
      // flow-root, not inline-block: both establish a BFC that contains the floated rightControls,
      // but inline-block participates in inline layout, so its height depends on baseline alignment
      // (an inline-block with only floated children has its baseline at its bottom edge), adding a
      // few px of phantom space below the bar that varies between view/edit/panel-edit. flow-root is
      // a block-level box and avoids that.
      display: 'flow-root',
      [theme.breakpoints.down('sm')]: {
        flexDirection: 'column-reverse',
        alignItems: 'stretch',
      },

      '&:hover .dashboard-canvas-controls': {
        opacity: 1,
      },
    }),
    embedded: css({
      background: 'unset',
      position: 'unset',
    }),
    // Original rightControls style
    rightControls: css({
      display: 'flex',
      gap: theme.spacing(1),
      float: 'right',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      maxWidth: '100%',
      minWidth: 0,
    }),
    fixedControls: css({
      display: 'flex',
      justifyContent: 'flex-end',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1),
      order: 2,
      marginLeft: 'auto',
      flexShrink: 0,
      alignSelf: 'flex-start',
    }),
    dashboardControlsButton: css({
      order: 2,
      marginLeft: 'auto',
    }),
    rightControlsWrap: css({
      flexWrap: 'wrap',
      marginLeft: 'auto',
    }),
    contextualNavToggle: css({
      display: 'inline-flex',
      margin: theme.spacing(0, 1, 1, 0),
    }),
  };
}
