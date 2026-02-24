import { css, cx } from '@emotion/css';

import { GrafanaTheme2, VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  SceneTimePicker,
  SceneRefreshPicker,
  SceneDebugger,
  VariableDependencyConfig,
  sceneGraph,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  CancelActivationHandler,
  sceneUtils,
} from '@grafana/scenes';
import { Box, Button, useStyles2 } from '@grafana/ui';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
import { ContextualNavigationPaneToggle } from 'app/features/scopes/dashboards/ContextualNavigationPaneToggle';

import { PanelEditControls } from '../panel-edit/PanelEditControls';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardDataLayerControls } from './DashboardDataLayerControls';
import { DashboardLinksControls } from './DashboardLinksControls';
import { DashboardScene } from './DashboardScene';
import { DrilldownControls } from './DrilldownControls';
import { VariableControls } from './VariableControls';
import { DashboardControlsButton } from './dashboard-controls-menu/DashboardControlsMenuButton';
import { hasDashboardControls, useHasDashboardControls } from './dashboard-controls-menu/utils';
import { DashboardFiltersOverviewPaneToggle } from './dashboard-filters-overview/DashboardFiltersOverviewPaneToggle';
import { EditDashboardSwitch } from './new-toolbar/actions/EditDashboardSwitch';
import { MakeDashboardEditableButton } from './new-toolbar/actions/MakeDashboardEditableButton';
import { SaveDashboard } from './new-toolbar/actions/SaveDashboard';
import { ShareDashboardButton } from './new-toolbar/actions/ShareDashboardButton';

export interface DashboardControlsState extends SceneObjectState {
  timePicker: SceneTimePicker;
  refreshPicker: SceneRefreshPicker;
  hideTimeControls?: boolean;
  hideVariableControls?: boolean;
  hideLinksControls?: boolean;
  // Hides the dashboard-controls dropdown menu
  hideDashboardControls?: boolean;
}

export class DashboardControls extends SceneObjectBase<DashboardControlsState> {
  static Component = DashboardControlsRenderer;

  protected _variableDependency = new VariableDependencyConfig(this, {
    onAnyVariableChanged: this._onAnyVariableChanged.bind(this),
  });

  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['_dash.hideTimePicker', '_dash.hideVariables', '_dash.hideLinks', '_dash.hideDashboardControls'],
  });

  /**
   * We want the hideXX url keys to only sync one way (url => state) on init
   * We don't want these flags to be added to URL.
   */
  getUrlState() {
    return {};
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const { hideTimeControls, hideVariableControls, hideLinksControls, hideDashboardControls } = this.state;
    const isEnabledViaUrl = (key: string) => values[key] === 'true' || values[key] === '';

    // Only allow hiding, never "unhiding" from url
    // Because this should really only change on first init it's fine to do multiple setState here

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
    const hasVariables = sceneGraph
      .getVariables(this)
      ?.state.variables.some((v) => v.state.hide !== VariableHide.hideVariable);
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
  } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  const { links, editPanel, isEditing } = dashboard.useState();
  const isQueryEditorNext = Boolean(editPanel?.state.useQueryExperienceNext);
  const styles = useStyles2(getStyles, isQueryEditorNext);
  const showDebugger = window.location.search.includes('scene-debugger');
  const hasDashboardControls = useHasDashboardControls(dashboard);

  // Get adhoc and groupby variables for drilldown controls
  const { variables } = sceneGraph.getVariables(dashboard)?.useState() ?? { variables: [] };
  const visibleVariables = variables.filter((v) => v.state.hide !== VariableHide.inControlsMenu);
  const adHocVar = visibleVariables.find((v) => sceneUtils.isAdHocVariable(v));
  const groupByVar = visibleVariables.find((v) => sceneUtils.isGroupByVariable(v));
  const useUnifiedDrilldownUI = config.featureToggles.dashboardAdHocAndGroupByWrapper && adHocVar && groupByVar;

  if (!model.hasControls()) {
    // To still have spacing when no controls are rendered
    return <Box padding={1}>{renderHiddenVariables(dashboard)}</Box>;
  }

  // When dashboardAdHocAndGroupByWrapper is enabled, use the new layout with topRow
  if (useUnifiedDrilldownUI) {
    return (
      <div
        data-testid={selectors.pages.Dashboard.Controls}
        className={cx(styles.controls, editPanel && styles.controlsPanelEdit)}
      >
        <div className={styles.topRow}>
          {config.featureToggles.scopeFilters && !editPanel && (
            <ContextualNavigationPaneToggle className={styles.contextualNavToggleNewLayout} hideWhenOpen={true} />
          )}
          {!hideVariableControls && (
            <div className={styles.drilldownControlsContainer}>
              <DrilldownControls adHocVar={adHocVar} groupByVar={groupByVar} isEditing={isEditing} />
            </div>
          )}
          <div className={cx(styles.rightControlsNewLayout, editPanel && styles.rightControlsWrap)}>
            {!hideTimeControls && (
              <div className={styles.fixedControlsNewLayout}>
                <timePicker.Component model={timePicker} />
                <refreshPicker.Component model={refreshPicker} />
              </div>
            )}
            {config.featureToggles.dashboardNewLayouts && (
              <div className={styles.fixedControlsNewLayout}>
                <DashboardControlActions dashboard={dashboard} />
              </div>
            )}
            {config.featureToggles.dashboardFiltersOverview && !config.featureToggles.dashboardNewLayouts && (
              <div className={styles.fixedControls}>
                <DashboardFiltersOverviewPaneToggle dashboard={dashboard} />
              </div>
            )}
          </div>
        </div>
        {!hideVariableControls && (
          <>
            <VariableControls dashboard={dashboard} />
            <DashboardDataLayerControls dashboard={dashboard} />
          </>
        )}
        {!hideLinksControls && !editPanel && <DashboardLinksControls links={links} dashboard={dashboard} />}
        {!hideDashboardControls && hasDashboardControls && <DashboardControlsButton dashboard={dashboard} />}
        {editPanel && <PanelEditControls panelEditor={editPanel} />}
        {showDebugger && <SceneDebugger scene={model} key={'scene-debugger'} />}
      </div>
    );
  }

  // Original layout when feature toggle is off
  return (
    <div
      data-testid={selectors.pages.Dashboard.Controls}
      className={cx(styles.controls, editPanel && styles.controlsPanelEdit)}
    >
      <div className={cx(styles.rightControls, editPanel && styles.rightControlsWrap)}>
        {!hideTimeControls && (
          <div className={styles.fixedControls}>
            <timePicker.Component model={timePicker} />
            <refreshPicker.Component model={refreshPicker} />
          </div>
        )}
        {config.featureToggles.dashboardNewLayouts && (
          <div className={styles.fixedControls}>
            <DashboardControlActions dashboard={dashboard} />
          </div>
        )}
        {config.featureToggles.dashboardFiltersOverview && (
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
          <VariableControls dashboard={dashboard} />
          <DashboardDataLayerControls dashboard={dashboard} />
        </>
      )}
      {!hideLinksControls && !editPanel && <DashboardLinksControls links={links} dashboard={dashboard} />}
      {!hideDashboardControls && hasDashboardControls && <DashboardControlsButton dashboard={dashboard} />}
      {editPanel && <PanelEditControls panelEditor={editPanel} />}
      {showDebugger && <SceneDebugger scene={model} key={'scene-debugger'} />}
    </div>
  );
}

function DashboardControlActions({ dashboard }: { dashboard: DashboardScene }) {
  const { isEditing, editPanel, uid, meta, editable } = dashboard.useState();
  const { isPlaying } = playlistSrv.useState();

  if (editPanel) {
    return null;
  }

  const canEditDashboard = dashboard.canEditDashboard();
  const hasUid = Boolean(uid);
  const isSnapshot = Boolean(meta.isSnapshot);
  const isEmbedded = meta.isEmbedded;
  const isEditable = Boolean(editable);
  const showShareButton = hasUid && !isSnapshot && !isEmbedded && !isPlaying;

  return (
    <>
      {showShareButton && <ShareDashboardButton dashboard={dashboard} />}
      {isEditing && <SaveDashboard dashboard={dashboard} />}
      {!isPlaying && canEditDashboard && isEditable && <EditDashboardSwitch dashboard={dashboard} />}
      {!isPlaying && canEditDashboard && !isEditable && !isEditing && (
        <MakeDashboardEditableButton dashboard={dashboard} />
      )}
      {isPlaying && (
        <Button
          variant="secondary"
          onClick={() => playlistSrv.stop()}
          data-testid={selectors.pages.Dashboard.DashNav.playlistControls.stop}
        >
          <Trans i18nKey="dashboard.toolbar.new.playlist-stop">Stop playlist</Trans>
        </Button>
      )}
    </>
  );
}

function renderHiddenVariables(dashboard: DashboardScene) {
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

function getStyles(theme: GrafanaTheme2, isQueryEditorNext: boolean) {
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
      display: 'inline-block',
      [theme.breakpoints.down('sm')]: {
        flexDirection: 'column-reverse',
        alignItems: 'stretch',
      },

      '&:hover .dashboard-canvas-controls': {
        opacity: 1,
      },
    }),
    controlsPanelEdit: css({
      flexWrap: 'wrap-reverse',
      ...(isQueryEditorNext && {
        padding: 0,
        marginBottom: theme.spacing(-1),
      }),
      paddingRight: 0,
    }),
    // New layout styles (used when feature toggle is on)
    topRow: css({
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing(1),
      width: '100%',
      marginBottom: theme.spacing(1),
      [theme.breakpoints.down('sm')]: {
        flexWrap: 'wrap',
      },
    }),
    drilldownControlsContainer: css({
      flex: 1,
      minWidth: 0,
      display: 'flex',
      [theme.breakpoints.down('sm')]: {
        order: 1, // Move below the time controls
        flex: '1 1 100%', // Take full width to force new line
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
    // Modified rightControls for new layout
    rightControlsNewLayout: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      flexShrink: 0,
    }),
    // Original fixedControls style
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
    // Fixed controls for new layout (no margin/order)
    fixedControlsNewLayout: css({
      display: 'flex',
      justifyContent: 'flex-end',
      gap: theme.spacing(1),
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
    contextualNavToggleNewLayout: css({
      display: 'inline-flex',
      flexShrink: 0,
    }),
  };
}
