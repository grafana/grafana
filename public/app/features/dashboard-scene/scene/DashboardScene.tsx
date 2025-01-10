import * as H from 'history';

import {
  AppEvents,
  CoreApp,
  DataQueryRequest,
  NavIndex,
  NavModelItem,
  locationUtil,
  DataSourceGetTagKeysOptions,
  DataSourceGetTagValuesOptions,
} from '@grafana/data';
import { config, locationService, RefreshEvent } from '@grafana/runtime';
import {
  sceneGraph,
  SceneGridRow,
  SceneObject,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneTimeRange,
  sceneUtils,
  SceneVariable,
  SceneVariableDependencyConfigLike,
  VizPanel,
} from '@grafana/scenes';
import { Dashboard, DashboardLink, LibraryPanel } from '@grafana/schema';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import appEvents from 'app/core/app_events';
import { ScrollRefElement } from 'app/core/components/NativeScrollbar';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import { getNavModel } from 'app/core/selectors/navModel';
import store from 'app/core/store';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { SaveDashboardAsOptions } from 'app/features/dashboard/components/SaveDashboard/types';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { getClosestScopesFacade, ScopesFacade } from 'app/features/scopes';
import { VariablesChanged } from 'app/features/variables/types';
import { DashboardDTO, DashboardMeta, KioskMode, SaveDashboardResponseDTO } from 'app/types';
import { ShowConfirmModalEvent } from 'app/types/events';

import { DashboardEditPane } from '../edit-pane/DashboardEditPane';
import { PanelEditor } from '../panel-edit/PanelEditor';
import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';
import { SaveDashboardDrawer } from '../saving/SaveDashboardDrawer';
import { DashboardChangeInfo } from '../saving/shared';
import { DashboardSceneSerializerLike, getDashboardSceneSerializer } from '../serialization/DashboardSceneSerializer';
import { buildGridItemForPanel, transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { gridItemToPanel } from '../serialization/transformSceneToSaveModel';
import { DecoratedRevisionModel } from '../settings/VersionsEditView';
import { DashboardEditView } from '../settings/utils';
import { historySrv } from '../settings/version-history';
import { DashboardModelCompatibilityWrapper } from '../utils/DashboardModelCompatibilityWrapper';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { djb2Hash } from '../utils/djb2Hash';
import { getDashboardUrl } from '../utils/getDashboardUrl';
import { getViewPanelUrl } from '../utils/urlBuilders';
import {
  getClosestVizPanel,
  getDashboardSceneFor,
  getDefaultVizPanel,
  getPanelIdForVizPanel,
  isPanelClone,
} from '../utils/utils';
import { SchemaV2EditorDrawer } from '../v2schema/SchemaV2EditorDrawer';

import { AddLibraryPanelDrawer } from './AddLibraryPanelDrawer';
import { DashboardControls } from './DashboardControls';
import { DashboardSceneRenderer } from './DashboardSceneRenderer';
import { DashboardSceneUrlSync } from './DashboardSceneUrlSync';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';
import { RowRepeaterBehavior } from './RowRepeaterBehavior';
import { ViewPanelScene } from './ViewPanelScene';
import { isUsingAngularDatasourcePlugin, isUsingAngularPanelPlugin } from './angular/AngularDeprecation';
import { setupKeyboardShortcuts } from './keyboardShortcuts';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { DashboardLayoutManager } from './types';

export const PERSISTED_PROPS = ['title', 'description', 'tags', 'editable', 'graphTooltip', 'links', 'meta', 'preload'];
export const PANEL_SEARCH_VAR = 'systemPanelFilterVar';
export const PANELS_PER_ROW_VAR = 'systemDynamicRowSizeVar';

export interface DashboardSceneState extends SceneObjectState {
  /** The title */
  title: string;
  /** The description */
  description?: string;
  /** Tags */
  tags?: string[];
  /** Links */
  links: DashboardLink[];
  /** Is editable */
  editable?: boolean;
  /** Allows disabling grid lazy loading */
  preload?: boolean;
  /** A uid when saved */
  uid?: string;
  /** @deprecated */
  id?: number | null;
  /** Layout of panels */
  body: DashboardLayoutManager;
  /** NavToolbar actions */
  actions?: SceneObject[];
  /** Fixed row at the top of the canvas with for example variables and time range controls */
  controls?: DashboardControls;
  /** True when editing */
  isEditing?: boolean;
  /** True when user made a change */
  isDirty?: boolean;
  /** meta flags */
  meta: DashboardMeta;
  /** Version of the dashboard */
  version?: number;
  /** Panel to inspect */
  inspectPanelKey?: string;
  /** Panel to view in fullscreen */
  viewPanelScene?: ViewPanelScene;
  /** Edit view */
  editview?: DashboardEditView;
  /** Edit panel */
  editPanel?: PanelEditor;
  /** Scene object that handles the current drawer or modal */
  overlay?: SceneObject;
  /** The dashboard doesn't have panels */
  isEmpty?: boolean;
  /** Kiosk mode */
  kioskMode?: KioskMode;
  /** Share view */
  shareView?: string;
  /** Renders panels in grid and filtered */
  panelSearch?: string;
  /** How many panels to show per row for search results */
  panelsPerRow?: number;
  /** options pane */
  editPane: DashboardEditPane;
}

export class DashboardScene extends SceneObjectBase<DashboardSceneState> {
  static Component = DashboardSceneRenderer;

  /**
   * Handles url sync
   */
  protected _urlSync = new DashboardSceneUrlSync(this);
  /**
   * Get notified when variables change
   */
  protected _variableDependency = new DashboardVariableDependency(this);

  /**
   * State before editing started
   */
  private _initialState?: DashboardSceneState;
  /**
   * Url state before editing started
   */
  private _initialUrlState?: H.Location;
  /**
   * Dashboard changes tracker
   */
  private _changeTracker: DashboardSceneChangeTracker;

  /**
   * A reference to the scopes facade
   */
  private _scopesFacade: ScopesFacade | null;
  /**
   * Remember scroll position when going into panel edit
   */
  private _scrollRef?: ScrollRefElement;
  private _prevScrollPos?: number;

  private _serializer: DashboardSceneSerializerLike<
    Dashboard | DashboardV2Spec,
    DashboardMeta | DashboardWithAccessInfo<DashboardV2Spec>['metadata']
  > = getDashboardSceneSerializer();

  public constructor(state: Partial<DashboardSceneState>) {
    super({
      title: 'Dashboard',
      meta: {},
      editable: true,
      $timeRange: state.$timeRange ?? new SceneTimeRange({}),
      body: state.body ?? DefaultGridLayoutManager.fromVizPanels(),
      links: state.links ?? [],
      ...state,
      editPane: new DashboardEditPane({}),
    });

    this._scopesFacade = getClosestScopesFacade(this);

    this._changeTracker = new DashboardSceneChangeTracker(this);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    let prevSceneContext = window.__grafanaSceneContext;

    window.__grafanaSceneContext = this;

    this._initializePanelSearch();

    if (this.state.isEditing) {
      this._initialUrlState = locationService.getLocation();
      this._changeTracker.startTrackingChanges();
    }

    if (this.state.meta.isNew) {
      this.onEnterEditMode();
      this.setState({ isDirty: true });
    }

    if (!this.state.meta.isEmbedded && this.state.uid) {
      dashboardWatcher.watch(this.state.uid);
    }

    let clearKeyBindings = () => {};
    if (!config.publicDashboardAccessToken) {
      clearKeyBindings = setupKeyboardShortcuts(this);
    }
    const oldDashboardWrapper = new DashboardModelCompatibilityWrapper(this);

    // @ts-expect-error
    getDashboardSrv().setCurrent(oldDashboardWrapper);

    // Deactivation logic
    return () => {
      window.__grafanaSceneContext = prevSceneContext;
      clearKeyBindings();
      this._changeTracker.terminate();
      oldDashboardWrapper.destroy();
      dashboardWatcher.leave();
    };
  }

  private _initializePanelSearch() {
    const systemPanelFilter = sceneGraph.lookupVariable(PANEL_SEARCH_VAR, this)?.getValue();
    if (typeof systemPanelFilter === 'string') {
      this.setState({ panelSearch: systemPanelFilter });
    }

    const panelsPerRow = sceneGraph.lookupVariable(PANELS_PER_ROW_VAR, this)?.getValue();
    if (typeof panelsPerRow === 'string') {
      const perRow = Number.parseInt(panelsPerRow, 10);
      this.setState({ panelsPerRow: Number.isInteger(perRow) ? perRow : undefined });
    }
  }

  public onEnterEditMode = () => {
    // Save this state
    this._initialState = sceneUtils.cloneSceneObjectState(this.state);
    this._initialUrlState = locationService.getLocation();

    // Switch to edit mode
    this.setState({ isEditing: true });

    // Propagate change edit mode change to children
    this.state.body.editModeChanged(true);

    // Propagate edit mode to scopes
    this._scopesFacade?.enterReadOnly();

    this._changeTracker.startTrackingChanges();
  };

  public saveCompleted(saveModel: Dashboard | DashboardV2Spec, result: SaveDashboardResponseDTO, folderUid?: string) {
    this._serializer.onSaveComplete(saveModel, result);

    this._changeTracker.stopTrackingChanges();

    this.setState({
      version: result.version,
      isDirty: false,
      uid: result.uid,
      id: result.id,
      meta: {
        ...this.state.meta,
        uid: result.uid,
        url: result.url,
        slug: result.slug,
        folderUid: folderUid,
        isNew: false,
        version: result.version,
      },
    });

    this.state.editPanel?.dashboardSaved();
    this._changeTracker.startTrackingChanges();
  }

  public exitEditMode({ skipConfirm, restoreInitialState }: { skipConfirm: boolean; restoreInitialState?: boolean }) {
    if (!this.canDiscard()) {
      console.error('Trying to discard back to a state that does not exist, initialState undefined');
      return;
    }

    if (!this.state.isDirty || skipConfirm) {
      this.exitEditModeConfirmed(restoreInitialState || this.state.isDirty);
      this._scopesFacade?.exitReadOnly();
      return;
    }

    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Discard changes to dashboard?',
        text: `You have unsaved changes to this dashboard. Are you sure you want to discard them?`,
        icon: 'trash-alt',
        yesText: 'Discard',
        onConfirm: () => {
          this.exitEditModeConfirmed();
          this._scopesFacade?.exitReadOnly();
        },
      })
    );
  }

  private exitEditModeConfirmed(restoreInitialState = true) {
    // No need to listen to changes anymore
    this._changeTracker.stopTrackingChanges();

    // We are updating url and removing editview and editPanel.
    // The initial url may be including edit view, edit panel or inspect query params if the user pasted the url,
    // hence we need to cleanup those query params to get back to the dashboard view. Otherwise url sync can trigger overlays.
    const url = locationUtil.getUrlForPartial(this._initialUrlState!, {
      editPanel: null,
      editview: null,
      inspect: null,
      inspectTab: null,
      shareView: null,
    });

    locationService.replace(locationUtil.stripBaseFromUrl(url));

    if (restoreInitialState) {
      //  Restore initial state and disable editing
      this.setState({ ...this._initialState, isEditing: false });
    } else {
      // Do not restore
      this.setState({ isEditing: false });
    }

    // if we are in edit panel, we need to onDiscard()
    // so the useEffect cleanup comes later and
    // doesn't try to commit the changes
    if (this.state.editPanel) {
      this.state.editPanel.onDiscard();
    }

    // Disable grid dragging
    this.state.body.editModeChanged(false);
  }

  public canDiscard() {
    return this._initialState !== undefined;
  }

  public pauseTrackingChanges() {
    this._changeTracker.stopTrackingChanges();
  }

  public resumeTrackingChanges() {
    this._changeTracker.startTrackingChanges();
  }

  public onRestore = async (version: DecoratedRevisionModel): Promise<boolean> => {
    const versionRsp = await historySrv.restoreDashboard(version.uid, version.version);

    if (!Number.isInteger(versionRsp.version)) {
      return false;
    }

    const dashboardDTO: DashboardDTO = {
      dashboard: new DashboardModel(version.data),
      meta: this.state.meta,
    };
    const dashScene = transformSaveModelToScene(dashboardDTO);
    const newState = sceneUtils.cloneSceneObjectState(dashScene.state);
    newState.version = versionRsp.version;

    this.setState(newState);
    this.exitEditMode({ skipConfirm: true, restoreInitialState: false });

    return true;
  };

  public openSaveDrawer({ saveAsCopy, onSaveSuccess }: { saveAsCopy?: boolean; onSaveSuccess?: () => void }) {
    if (!this.state.isEditing) {
      return;
    }

    this.setState({
      overlay: new SaveDashboardDrawer({
        dashboardRef: this.getRef(),
        saveAsCopy,
        onSaveSuccess,
      }),
    });
  }

  public openV2SchemaEditor() {
    this.setState({
      overlay: new SchemaV2EditorDrawer({
        dashboardRef: this.getRef(),
      }),
    });
  }

  public getPageNav(location: H.Location, navIndex: NavIndex) {
    const { meta, viewPanelScene, editPanel } = this.state;

    if (meta.dashboardNotFound) {
      return { text: 'Not found' };
    }

    let pageNav: NavModelItem = {
      text: this.state.title,
      url: getDashboardUrl({
        uid: this.state.uid,
        slug: meta.slug,
        currentQueryParams: location.search,
        updateQuery: { viewPanel: null, inspect: null, editview: null, editPanel: null, tab: null, shareView: null },
        isHomeDashboard: !meta.url && !meta.slug && !meta.isNew,
      }),
    };

    const { folderUid } = meta;

    if (folderUid) {
      const folderNavModel = getNavModel(navIndex, `folder-dashboards-${folderUid}`).main;
      // If the folder hasn't loaded (maybe user doesn't have permission on it?) then
      // don't show the "page not found" breadcrumb
      if (folderNavModel.id !== 'not-found') {
        pageNav = {
          ...pageNav,
          parentItem: folderNavModel,
        };
      }
    }

    if (viewPanelScene) {
      pageNav = {
        text: 'View panel',
        parentItem: pageNav,
        url: getViewPanelUrl(viewPanelScene.state.panelRef.resolve()),
      };
    }

    if (editPanel) {
      pageNav = {
        text: 'Edit panel',
        parentItem: pageNav,
      };
    }

    return pageNav;
  }

  /**
   * Returns the body (layout) or the full view panel
   */
  public getBodyToRender(): SceneObject {
    return this.state.viewPanelScene ?? this.state.body;
  }

  public getInitialState(): DashboardSceneState | undefined {
    return this._initialState;
  }

  public addPanel(vizPanel: VizPanel): void {
    if (!this.state.isEditing) {
      this.onEnterEditMode();
    }

    this.state.body.addPanel(vizPanel);
  }

  public createLibraryPanel(panelToReplace: VizPanel, libPanel: LibraryPanel) {
    const body = panelToReplace.clone({
      $behaviors: [new LibraryPanelBehavior({ uid: libPanel.uid, name: libPanel.name })],
    });

    const gridItem = panelToReplace.parent;

    if (!(gridItem instanceof DashboardGridItem)) {
      throw new Error("Trying to replace a panel that doesn't have a parent grid item");
    }

    gridItem.setState({ body });
  }

  public duplicatePanel(vizPanel: VizPanel) {
    this.state.body.duplicatePanel(vizPanel);
  }

  public copyPanel(vizPanel: VizPanel) {
    if (!vizPanel.parent) {
      return;
    }

    let gridItem = vizPanel.parent;

    if (!(gridItem instanceof DashboardGridItem)) {
      console.error('Trying to copy a panel that is not DashboardGridItem child');
      throw new Error('Trying to copy a panel that is not DashboardGridItem child');
    }

    const jsonData = gridItemToPanel(gridItem);

    store.set(LS_PANEL_COPY_KEY, JSON.stringify(jsonData));
    appEvents.emit(AppEvents.alertSuccess, ['Panel copied. Use **Paste panel** toolbar action to paste.']);
  }

  public pastePanel() {
    const jsonData = store.get(LS_PANEL_COPY_KEY);
    const jsonObj = JSON.parse(jsonData);
    const panelModel = new PanelModel(jsonObj);
    const gridItem = buildGridItemForPanel(panelModel);
    const panel = gridItem.state.body;

    this.addPanel(panel);

    store.delete(LS_PANEL_COPY_KEY);
  }

  public removePanel(panel: VizPanel) {
    this.state.body.removePanel(panel);
  }

  public unlinkLibraryPanel(panel: VizPanel) {
    if (!panel.parent) {
      return;
    }

    const gridItem = panel.parent;

    if (!(gridItem instanceof DashboardGridItem)) {
      console.error('Trying to unlink a lib panel in a layout that is not DashboardGridItem');
      return;
    }

    gridItem.state.body.setState({ $behaviors: undefined });
  }

  public showModal(modal: SceneObject) {
    this.setState({ overlay: modal });
  }

  public closeModal() {
    this.setState({ overlay: undefined });
  }

  public async onStarDashboard() {
    const { meta, uid } = this.state;
    if (!uid) {
      return;
    }
    try {
      const result = await getDashboardSrv().starDashboard(uid, Boolean(meta.isStarred));

      this.setState({
        meta: {
          ...meta,
          isStarred: result,
        },
      });
    } catch (err) {
      console.error('Failed to star dashboard', err);
    }
  }

  public onOpenSettings = () => {
    locationService.partial({ editview: 'settings' });
  };

  public onShowAddLibraryPanelDrawer(panelToReplaceRef?: SceneObjectRef<VizPanel>) {
    this.setState({
      overlay: new AddLibraryPanelDrawer({ panelToReplaceRef }),
    });
  }

  public onCreateNewRow() {
    this.state.body.addNewRow();
  }

  public onCreateNewPanel(): VizPanel {
    const vizPanel = getDefaultVizPanel();

    this.addPanel(vizPanel);

    return vizPanel;
  }

  public switchLayout(layout: DashboardLayoutManager) {
    this.setState({ body: layout });
  }

  /**
   * Called by the SceneQueryRunner to privide contextural parameters (tracking) props for the request
   */
  public enrichDataRequest(sceneObject: SceneObject): Partial<DataQueryRequest> {
    const dashboard = getDashboardSceneFor(sceneObject);

    let panel = getClosestVizPanel(sceneObject);

    if (dashboard.state.isEditing && dashboard.state.editPanel) {
      panel = dashboard.state.editPanel.state.panelRef.resolve();
    }

    let panelId = 0;

    if (panel && panel.state.key) {
      if (isPanelClone(panel.state.key)) {
        panelId = djb2Hash(panel?.state.key);
      } else {
        panelId = getPanelIdForVizPanel(panel);
      }
    }

    return {
      app: CoreApp.Dashboard,
      dashboardUID: this.state.uid,
      panelId,
      panelName: panel?.state?.title,
      panelPluginId: panel?.state.pluginId,
      scopes: this._scopesFacade?.value,
    };
  }

  public enrichFiltersRequest(): Partial<DataSourceGetTagKeysOptions | DataSourceGetTagValuesOptions> {
    return {
      scopes: this._scopesFacade?.value,
    };
  }

  canEditDashboard() {
    const { meta } = this.state;

    return Boolean(meta.canEdit || meta.canMakeEditable);
  }

  public getInitialSaveModel() {
    return this._serializer.initialSaveModel;
  }

  public getSnapshotUrl = () => {
    return this._serializer.getSnapshotUrl();
  };

  /** Hacky temp function until we refactor transformSaveModelToScene a bit */
  setInitialSaveModel(model?: Dashboard, meta?: DashboardMeta): void;
  setInitialSaveModel(model?: DashboardV2Spec, meta?: DashboardWithAccessInfo<DashboardV2Spec>['metadata']): void;
  public setInitialSaveModel(
    saveModel?: Dashboard | DashboardV2Spec,
    meta?: DashboardMeta | DashboardWithAccessInfo<DashboardV2Spec>['metadata']
  ): void {
    this._serializer.initialSaveModel = saveModel;
    this._serializer.metadata = meta;
  }

  public getTrackingInformation() {
    return this._serializer.getTrackingInformation(this);
  }

  public async onDashboardDelete() {
    // Need to mark it non dirty to navigate away without unsaved changes warning
    this.setState({ isDirty: false });
    locationService.replace('/');
  }

  public getDashboardPanels() {
    return dashboardSceneGraph.getVizPanels(this);
  }

  public hasDashboardAngularPlugins() {
    const sceneGridLayout = this.state.body;
    if (!(sceneGridLayout instanceof DefaultGridLayoutManager)) {
      return false;
    }
    const gridItems = sceneGridLayout.state.grid.state.children;
    const dashboardWasAngular = gridItems.some((gridItem) => {
      if (!(gridItem instanceof DashboardGridItem)) {
        return false;
      }
      const isAngularPanel = isUsingAngularPanelPlugin(gridItem.state.body);
      const isAngularDs = isUsingAngularDatasourcePlugin(gridItem.state.body);
      return isAngularPanel || isAngularDs;
    });
    return dashboardWasAngular;
  }

  public onSetScrollRef = (scrollElement: ScrollRefElement): void => {
    this._scrollRef = scrollElement;
  };

  public rememberScrollPos() {
    this._prevScrollPos = this._scrollRef?.scrollTop;
  }

  public restoreScrollPos() {
    if (this._prevScrollPos !== undefined) {
      this._scrollRef?.scrollTo(0, this._prevScrollPos!);
    }
  }

  getSaveModel(): Dashboard | DashboardV2Spec {
    return this._serializer.getSaveModel(this);
  }

  getSaveAsModel(options: SaveDashboardAsOptions): Dashboard | DashboardV2Spec {
    return this._serializer.getSaveAsModel(this, options);
  }

  getDashboardChanges(saveTimeRange?: boolean, saveVariables?: boolean, saveRefresh?: boolean): DashboardChangeInfo {
    return this._serializer.getDashboardChangesFromScene(this, { saveTimeRange, saveVariables, saveRefresh });
  }
}

export class DashboardVariableDependency implements SceneVariableDependencyConfigLike {
  private _emptySet = new Set<string>();

  public constructor(private _dashboard: DashboardScene) {}

  getNames(): Set<string> {
    return this._emptySet;
  }

  public hasDependencyOn(): boolean {
    return false;
  }

  public variableUpdateCompleted(variable: SceneVariable, hasChanged: boolean) {
    if (hasChanged) {
      // Temp solution for some core panels (like dashlist) to know that variables have changed
      appEvents.publish(new VariablesChanged({ refreshAll: true, panelIds: [] }));
      // Backwards compat with plugins that rely on the RefreshEvent when a
      // variable changes. TODO: We should redirect plugin devs to use VariablesChanged event
      this._dashboard.publishEvent(new RefreshEvent());
    }

    if (variable.state.name === PANEL_SEARCH_VAR) {
      const searchValue = variable.getValue();
      if (typeof searchValue === 'string') {
        this._dashboard.setState({ panelSearch: searchValue });
      }
    } else if (variable.state.name === PANELS_PER_ROW_VAR) {
      const panelsPerRow = variable.getValue();
      if (typeof panelsPerRow === 'string') {
        const perRow = Number.parseInt(panelsPerRow, 10);
        this._dashboard.setState({ panelsPerRow: Number.isInteger(perRow) ? perRow : undefined });
      }
    }

    /**
     * Propagate variable changes to repeat row behavior as it does not get it when it's nested under local value
     * The first repeated row has the row repeater behavior but it also has a local SceneVariableSet with a local variable value
     */
    const layout = this._dashboard.state.body;
    if (!(layout instanceof DefaultGridLayoutManager)) {
      return;
    }

    for (const child of layout.state.grid.state.children) {
      if (!(child instanceof SceneGridRow) || !child.state.$behaviors) {
        continue;
      }

      for (const behavior of child.state.$behaviors) {
        if (behavior instanceof RowRepeaterBehavior) {
          if (behavior.isWaitingForVariables || (behavior.state.variableName === variable.state.name && hasChanged)) {
            behavior.performRepeat(true);
          } else if (!behavior.isWaitingForVariables && behavior.state.variableName === variable.state.name) {
            behavior.notifyRepeatedPanelsWaitingForVariables(variable);
          }
        }
      }
    }
  }
}

export function isV2Dashboard(model: Dashboard | DashboardV2Spec): model is DashboardV2Spec {
  return 'elements' in model;
}
