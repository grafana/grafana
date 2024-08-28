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
import { config, locationService } from '@grafana/runtime';
import {
  SceneFlexLayout,
  sceneGraph,
  SceneGridLayout,
  SceneGridRow,
  SceneObject,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  sceneUtils,
  SceneVariable,
  SceneVariableDependencyConfigLike,
  VizPanel,
} from '@grafana/scenes';
import { Dashboard, DashboardLink, LibraryPanel } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { ScrollRefElement } from 'app/core/components/NativeScrollbar';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import { getNavModel } from 'app/core/selectors/navModel';
import store from 'app/core/store';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { getClosestScopesFacade, ScopesFacade } from 'app/features/scopes';
import { VariablesChanged } from 'app/features/variables/types';
import { DashboardDTO, DashboardMeta, KioskMode, SaveDashboardResponseDTO } from 'app/types';
import { ShowConfirmModalEvent } from 'app/types/events';

import { PanelEditor } from '../panel-edit/PanelEditor';
import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';
import { SaveDashboardDrawer } from '../saving/SaveDashboardDrawer';
import {
  buildGridItemForLibPanel,
  buildGridItemForPanel,
  transformSaveModelToScene,
} from '../serialization/transformSaveModelToScene';
import { gridItemToPanel } from '../serialization/transformSceneToSaveModel';
import { DecoratedRevisionModel } from '../settings/VersionsEditView';
import { DashboardEditView } from '../settings/utils';
import { historySrv } from '../settings/version-history';
import { DashboardModelCompatibilityWrapper } from '../utils/DashboardModelCompatibilityWrapper';
import { dashboardSceneGraph, getLibraryVizPanelFromVizPanel } from '../utils/dashboardSceneGraph';
import { djb2Hash } from '../utils/djb2Hash';
import { getDashboardUrl, getViewPanelUrl } from '../utils/urlBuilders';
import {
  NEW_PANEL_HEIGHT,
  NEW_PANEL_WIDTH,
  forceRenderChildren,
  getClosestVizPanel,
  getDashboardSceneFor,
  getDefaultRow,
  getDefaultVizPanel,
  getPanelIdForVizPanel,
  getVizPanelKeyForPanelId,
  isPanelClone,
} from '../utils/utils';

import { AddLibraryPanelDrawer } from './AddLibraryPanelDrawer';
import { DashboardControls } from './DashboardControls';
import { DashboardGridItem } from './DashboardGridItem';
import { DashboardSceneRenderer } from './DashboardSceneRenderer';
import { DashboardSceneUrlSync } from './DashboardSceneUrlSync';
import { LibraryVizPanel } from './LibraryVizPanel';
import { RowRepeaterBehavior } from './RowRepeaterBehavior';
import { ViewPanelScene } from './ViewPanelScene';
import { setupKeyboardShortcuts } from './keyboardShortcuts';

export const PERSISTED_PROPS = ['title', 'description', 'tags', 'editable', 'graphTooltip', 'links', 'meta', 'preload'];

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
  body: SceneObject;
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
   * The save model which the scene was originally created from
   */
  private _initialSaveModel?: Dashboard;
  /**
   * Url state before editing started
   */
  private _initialUrlState?: H.Location;
  /**
   * Dashboard changes tracker
   */
  private _changeTracker: DashboardSceneChangeTracker;

  /**
   * Flag to indicate if the user came from Explore
   */
  private _fromExplore = false;

  /**
   * A reference to the scopes facade
   */
  private _scopesFacade: ScopesFacade | null;
  /**
   * Remember scroll position when going into panel edit
   */
  private _scrollRef?: ScrollRefElement;
  private _prevScrollPos?: number;

  public constructor(state: Partial<DashboardSceneState>) {
    super({
      title: 'Dashboard',
      meta: {},
      editable: true,
      body: state.body ?? new SceneFlexLayout({ children: [] }),
      links: state.links ?? [],
      ...state,
    });

    this._scopesFacade = getClosestScopesFacade(this);

    this._changeTracker = new DashboardSceneChangeTracker(this);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    let prevSceneContext = window.__grafanaSceneContext;

    window.__grafanaSceneContext = this;

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

  public onEnterEditMode = (fromExplore = false) => {
    this._fromExplore = fromExplore;
    // Save this state
    this._initialState = sceneUtils.cloneSceneObjectState(this.state);
    this._initialUrlState = locationService.getLocation();

    // Switch to edit mode
    this.setState({ isEditing: true });

    // Propagate change edit mode change to children
    this.propagateEditModeChange();

    // Propagate edit mode to scopes
    this._scopesFacade?.enterReadOnly();

    this._changeTracker.startTrackingChanges();
  };

  public saveCompleted(saveModel: Dashboard, result: SaveDashboardResponseDTO, folderUid?: string) {
    this._initialSaveModel = {
      ...saveModel,
      id: result.id,
      uid: result.uid,
      version: result.version,
    };

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
      },
    });

    this._changeTracker.startTrackingChanges();
  }

  private propagateEditModeChange() {
    if (this.state.body instanceof SceneGridLayout) {
      this.state.body.setState({ isDraggable: this.state.isEditing, isResizable: this.state.isEditing });
      forceRenderChildren(this.state.body, true);
    }
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
    locationService.replace(
      locationUtil.getUrlForPartial(this._initialUrlState!, {
        editPanel: null,
        editview: null,
        inspect: null,
        inspectTab: null,
        shareView: null,
      })
    );

    if (this._fromExplore) {
      this.cleanupStateFromExplore();
    }

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
    this.propagateEditModeChange();
  }

  private cleanupStateFromExplore() {
    this._fromExplore = false;
    // When coming from explore but discarding changes, remove the panel that explore is potentially adding.
    if (this._initialSaveModel?.panels) {
      this._initialSaveModel.panels = this._initialSaveModel.panels.slice(1);
    }

    if (this._initialState && this._initialState.body instanceof SceneGridLayout) {
      this._initialState.body.setState({
        children: this._initialState.body.state.children.slice(1),
      });
    }
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

  public addRow(row: SceneGridRow) {
    if (!(this.state.body instanceof SceneGridLayout)) {
      throw new Error('Trying to add a panel in a layout that is not SceneGridLayout');
    }

    const sceneGridLayout = this.state.body;

    // find all panels until the first row and put them into the newly created row. If there are no other rows,
    // add all panels to the row. If there are no panels just create an empty row
    const indexTillNextRow = sceneGridLayout.state.children.findIndex((child) => child instanceof SceneGridRow);
    const rowChildren = sceneGridLayout.state.children
      .splice(0, indexTillNextRow === -1 ? sceneGridLayout.state.children.length : indexTillNextRow)
      .map((child) => child.clone());

    if (rowChildren) {
      row.setState({
        children: rowChildren,
      });
    }

    sceneGridLayout.setState({
      children: [row, ...sceneGridLayout.state.children],
    });
  }

  public removeRow(row: SceneGridRow, removePanels = false) {
    if (!(this.state.body instanceof SceneGridLayout)) {
      throw new Error('Trying to add a panel in a layout that is not SceneGridLayout');
    }

    const sceneGridLayout = this.state.body;

    const children = sceneGridLayout.state.children.filter((child) => child.state.key !== row.state.key);

    if (!removePanels) {
      const rowChildren = row.state.children.map((child) => child.clone());
      const indexOfRow = sceneGridLayout.state.children.findIndex((child) => child.state.key === row.state.key);

      children.splice(indexOfRow, 0, ...rowChildren);
    }

    sceneGridLayout.setState({ children });
  }

  public addPanel(vizPanel: VizPanel): void {
    if (!(this.state.body instanceof SceneGridLayout)) {
      throw new Error('Trying to add a panel in a layout that is not SceneGridLayout');
    }

    const sceneGridLayout = this.state.body;

    const panelId = getPanelIdForVizPanel(vizPanel);
    const newGridItem = new DashboardGridItem({
      height: NEW_PANEL_HEIGHT,
      width: NEW_PANEL_WIDTH,
      x: 0,
      y: 0,
      body: vizPanel,
      key: `grid-item-${panelId}`,
    });

    sceneGridLayout.setState({
      children: [newGridItem, ...sceneGridLayout.state.children],
    });
  }

  public createLibraryPanel(panelToReplace: VizPanel, libPanel: LibraryPanel) {
    const layout = this.state.body;

    if (!(layout instanceof SceneGridLayout)) {
      throw new Error('Trying to add a panel in a layout that is not SceneGridLayout');
    }

    const panelKey = panelToReplace.state.key;

    const body = new LibraryVizPanel({
      title: libPanel.model?.title ?? 'Panel',
      uid: libPanel.uid,
      name: libPanel.name,
      panelKey: panelKey ?? getVizPanelKeyForPanelId(dashboardSceneGraph.getNextPanelId(this)),
    });

    const gridItem = panelToReplace.parent;

    if (!(gridItem instanceof DashboardGridItem)) {
      throw new Error("Trying to replace a panel that doesn't have a parent grid item");
    }

    gridItem.setState({ body });
  }

  public duplicatePanel(vizPanel: VizPanel) {
    if (!vizPanel.parent) {
      return;
    }

    const libraryPanel = getLibraryVizPanelFromVizPanel(vizPanel);

    const gridItem = libraryPanel ? libraryPanel.parent : vizPanel.parent;

    if (!(gridItem instanceof DashboardGridItem)) {
      console.error('Trying to duplicate a panel in a layout that is not DashboardGridItem');
      return;
    }

    let panelState;
    let panelData;
    let newGridItem;
    const newPanelId = dashboardSceneGraph.getNextPanelId(this);

    if (libraryPanel) {
      const gridItemToDuplicateState = sceneUtils.cloneSceneObjectState(gridItem.state);

      newGridItem = new DashboardGridItem({
        x: gridItemToDuplicateState.x,
        y: gridItemToDuplicateState.y,
        width: gridItemToDuplicateState.width,
        height: gridItemToDuplicateState.height,
        body: new LibraryVizPanel({
          title: libraryPanel.state.title,
          uid: libraryPanel.state.uid,
          name: libraryPanel.state.name,
          panelKey: getVizPanelKeyForPanelId(newPanelId),
        }),
      });
    } else {
      if (gridItem instanceof DashboardGridItem) {
        panelState = sceneUtils.cloneSceneObjectState(gridItem.state.body.state);
        panelData = sceneGraph.getData(gridItem.state.body).clone();
      } else {
        panelState = sceneUtils.cloneSceneObjectState(vizPanel.state);
        panelData = sceneGraph.getData(vizPanel).clone();
      }

      // when we duplicate a panel we don't want to clone the alert state
      delete panelData.state.data?.alertState;

      newGridItem = new DashboardGridItem({
        x: gridItem.state.x,
        y: gridItem.state.y,
        height: gridItem.state.height,
        width: gridItem.state.width,
        body: new VizPanel({ ...panelState, $data: panelData, key: getVizPanelKeyForPanelId(newPanelId) }),
      });
    }

    if (!(this.state.body instanceof SceneGridLayout)) {
      console.error('Trying to duplicate a panel in a layout that is not SceneGridLayout ');
      return;
    }

    const sceneGridLayout = this.state.body;

    if (gridItem.parent instanceof SceneGridRow) {
      const row = gridItem.parent;

      row.setState({
        children: [...row.state.children, newGridItem],
      });

      sceneGridLayout.forceRender();

      return;
    }

    sceneGridLayout.setState({
      children: [...sceneGridLayout.state.children, newGridItem],
    });
  }

  public copyPanel(vizPanel: VizPanel) {
    if (!vizPanel.parent) {
      return;
    }

    let gridItem = vizPanel.parent;

    if (vizPanel.parent instanceof LibraryVizPanel) {
      const libraryVizPanel = vizPanel.parent;

      if (!libraryVizPanel.parent) {
        return;
      }

      gridItem = libraryVizPanel.parent;
    }

    if (!(gridItem instanceof DashboardGridItem)) {
      console.error('Trying to copy a panel that is not DashboardGridItem child');
      throw new Error('Trying to copy a panel that is not DashboardGridItem child');
    }

    const jsonData = gridItemToPanel(gridItem);

    store.set(LS_PANEL_COPY_KEY, JSON.stringify(jsonData));
    appEvents.emit(AppEvents.alertSuccess, ['Panel copied. Use **Paste panel** toolbar action to paste.']);
  }

  public pastePanel() {
    if (!(this.state.body instanceof SceneGridLayout)) {
      throw new Error('Trying to add a panel in a layout that is not SceneGridLayout');
    }

    const jsonData = store.get(LS_PANEL_COPY_KEY);
    const jsonObj = JSON.parse(jsonData);
    const panelModel = new PanelModel(jsonObj);
    const gridItem = !panelModel.libraryPanel
      ? buildGridItemForPanel(panelModel)
      : buildGridItemForLibPanel(panelModel);

    const sceneGridLayout = this.state.body;

    if (!(gridItem instanceof DashboardGridItem)) {
      throw new Error('Cannot paste invalid grid item');
    }

    const panelId = dashboardSceneGraph.getNextPanelId(this);

    if (gridItem instanceof DashboardGridItem && gridItem.state.body instanceof LibraryVizPanel) {
      const panelKey = getVizPanelKeyForPanelId(panelId);

      gridItem.state.body.setState({ panelKey });

      const vizPanel = gridItem.state.body.state.panel;

      if (vizPanel instanceof VizPanel) {
        vizPanel.setState({ key: panelKey });
      }
    } else if (gridItem instanceof DashboardGridItem && gridItem.state.body) {
      gridItem.state.body.setState({
        key: getVizPanelKeyForPanelId(panelId),
      });
    } else if (gridItem instanceof DashboardGridItem) {
      gridItem.state.body.setState({
        key: getVizPanelKeyForPanelId(panelId),
      });
    }

    gridItem.setState({
      height: NEW_PANEL_HEIGHT,
      width: NEW_PANEL_WIDTH,
      x: 0,
      y: 0,
      key: `grid-item-${panelId}`,
    });

    sceneGridLayout.setState({
      children: [gridItem, ...sceneGridLayout.state.children],
    });

    store.delete(LS_PANEL_COPY_KEY);
  }

  public removePanel(panel: VizPanel) {
    const panels: SceneObject[] = [];
    const key = panel.parent instanceof LibraryVizPanel ? panel.parent.parent?.state.key : panel.parent?.state.key;

    if (!key) {
      return;
    }

    let row: SceneGridRow | undefined;

    try {
      row = sceneGraph.getAncestor(panel, SceneGridRow);
    } catch {
      row = undefined;
    }

    if (row) {
      row.state.children.forEach((child: SceneObject) => {
        if (child.state.key !== key) {
          panels.push(child);
        }
      });

      row.setState({ children: panels });

      this.state.body.forceRender();

      return;
    }

    this.state.body.forEachChild((child: SceneObject) => {
      if (child.state.key !== key) {
        panels.push(child);
      }
    });

    const layout = this.state.body;

    if (layout instanceof SceneGridLayout || layout instanceof SceneFlexLayout) {
      layout.setState({ children: panels });
    }
  }

  public unlinkLibraryPanel(panel: LibraryVizPanel) {
    if (!panel.parent) {
      return;
    }

    const gridItem = panel.parent;

    if (!(gridItem instanceof DashboardGridItem)) {
      console.error('Trying to unlinka a lib panel in a layout that is not DashboardGridItem');
      return;
    }

    gridItem?.setState({
      body: panel.state.panel?.clone(),
    });
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

  public onShowAddLibraryPanelDrawer(panelToReplaceRef?: SceneObjectRef<LibraryVizPanel>) {
    this.setState({
      overlay: new AddLibraryPanelDrawer({ panelToReplaceRef }),
    });
  }

  public onCreateNewRow() {
    const row = getDefaultRow(this);

    this.addRow(row);

    return getPanelIdForVizPanel(row);
  }

  public onCreateNewPanel(): VizPanel {
    if (!this.state.isEditing) {
      this.onEnterEditMode();
    }

    const vizPanel = getDefaultVizPanel(this);

    this.addPanel(vizPanel);

    return vizPanel;
  }

  /**
   * Called by the SceneQueryRunner to privide contextural parameters (tracking) props for the request
   */
  public enrichDataRequest(sceneObject: SceneObject): Partial<DataQueryRequest> {
    const dashboard = getDashboardSceneFor(sceneObject);

    let panel = getClosestVizPanel(sceneObject);

    if (dashboard.state.isEditing && dashboard.state.editPanel) {
      panel = dashboard.state.editPanel.state.vizManager.state.panel;
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
    return this._initialSaveModel;
  }

  /** Hacky temp function until we refactor transformSaveModelToScene a bit */
  public setInitialSaveModel(saveModel: Dashboard) {
    this._initialSaveModel = saveModel;
  }

  public async onDashboardDelete() {
    // Need to mark it non dirty to navigate away without unsaved changes warning
    this.setState({ isDirty: false });
    locationService.replace('/');
  }

  public collapseAllRows() {
    if (!(this.state.body instanceof SceneGridLayout)) {
      throw new Error('Dashboard scene layout is not SceneGridLayout');
    }

    const sceneGridLayout = this.state.body;

    sceneGridLayout.state.children.forEach((child) => {
      if (!(child instanceof SceneGridRow)) {
        return;
      }
      if (!child.state.isCollapsed) {
        sceneGridLayout.toggleRow(child);
      }
    });
  }

  public expandAllRows() {
    if (!(this.state.body instanceof SceneGridLayout)) {
      throw new Error('Dashboard scene layout is not SceneGridLayout');
    }

    const sceneGridLayout = this.state.body;

    sceneGridLayout.state.children.forEach((child) => {
      if (!(child instanceof SceneGridRow)) {
        return;
      }
      if (child.state.isCollapsed) {
        sceneGridLayout.toggleRow(child);
      }
    });
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
    }

    /**
     * Propagate variable changes to repeat row behavior as it does not get it when it's nested under local value
     * The first repeated row has the row repeater behavior but it also has a local SceneVariableSet with a local variable value
     */
    const layout = this._dashboard.state.body;
    if (!(layout instanceof SceneGridLayout)) {
      return;
    }

    for (const child of layout.state.children) {
      if (!(child instanceof SceneGridRow) || !child.state.$behaviors) {
        continue;
      }

      for (const behavior of child.state.$behaviors) {
        if (behavior instanceof RowRepeaterBehavior) {
          if (behavior.isWaitingForVariables || (behavior.state.variableName === variable.state.name && hasChanged)) {
            behavior.performRepeat();
          }
        }
      }
    }
  }
}
