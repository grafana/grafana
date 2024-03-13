import * as H from 'history';

import { AppEvents, CoreApp, DataQueryRequest, NavIndex, NavModelItem, locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  getUrlSyncManager,
  SceneFlexLayout,
  sceneGraph,
  SceneGridItem,
  SceneGridLayout,
  SceneGridRow,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  sceneUtils,
  SceneVariable,
  SceneVariableDependencyConfigLike,
  VizPanel,
} from '@grafana/scenes';
import { Dashboard, DashboardLink } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import { getNavModel } from 'app/core/selectors/navModel';
import store from 'app/core/store';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { VariablesChanged } from 'app/features/variables/types';
import { DashboardDTO, DashboardMeta, SaveDashboardResponseDTO } from 'app/types';
import { ShowConfirmModalEvent } from 'app/types/events';

import { PanelEditor } from '../panel-edit/PanelEditor';
import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';
import { SaveDashboardDrawer } from '../saving/SaveDashboardDrawer';
import { DashboardSceneRenderer } from '../scene/DashboardSceneRenderer';
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
import { getDashboardUrl } from '../utils/urlBuilders';
import {
  NEW_PANEL_HEIGHT,
  NEW_PANEL_WIDTH,
  forceRenderChildren,
  getClosestVizPanel,
  getDefaultRow,
  getDefaultVizPanel,
  getPanelIdForVizPanel,
  getVizPanelKeyForPanelId,
  isPanelClone,
} from '../utils/utils';

import { AddLibraryPanelWidget } from './AddLibraryPanelWidget';
import { DashboardControls } from './DashboardControls';
import { DashboardSceneUrlSync } from './DashboardSceneUrlSync';
import { LibraryVizPanel } from './LibraryVizPanel';
import { PanelRepeaterGridItem } from './PanelRepeaterGridItem';
import { ViewPanelScene } from './ViewPanelScene';
import { setupKeyboardShortcuts } from './keyboardShortcuts';

export const PERSISTED_PROPS = ['title', 'description', 'tags', 'editable', 'graphTooltip', 'links', 'meta'];

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
  /** True when a user copies a panel in the dashboard */
  hasCopiedPanel?: boolean;
  /** The dashboard doesn't have panels */
  isEmpty?: boolean;
}

export class DashboardScene extends SceneObjectBase<DashboardSceneState> {
  static listenToChangesInProps = PERSISTED_PROPS;
  static Component = DashboardSceneRenderer;

  /**
   * Handles url sync
   */
  protected _urlSync = new DashboardSceneUrlSync(this);
  /**
   * Get notified when variables change
   */
  protected _variableDependency = new DashboardVariableDependency();

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

  public constructor(state: Partial<DashboardSceneState>) {
    super({
      title: 'Dashboard',
      meta: {},
      editable: true,
      body: state.body ?? new SceneFlexLayout({ children: [] }),
      links: state.links ?? [],
      hasCopiedPanel: store.exists(LS_PANEL_COPY_KEY),
      ...state,
    });

    this._changeTracker = new DashboardSceneChangeTracker(this);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    let prevSceneContext = window.__grafanaSceneContext;

    window.__grafanaSceneContext = this;

    if (this.state.isEditing) {
      this._changeTracker.startTrackingChanges();
    }

    if (!this.state.meta.isEmbedded && this.state.uid) {
      dashboardWatcher.watch(this.state.uid);
    }

    const clearKeyBindings = setupKeyboardShortcuts(this);
    const oldDashboardWrapper = new DashboardModelCompatibilityWrapper(this);

    // @ts-expect-error
    getDashboardSrv().setCurrent(oldDashboardWrapper);

    // Deactivation logic
    return () => {
      window.__grafanaSceneContext = prevSceneContext;
      clearKeyBindings();
      this._changeTracker.terminate();
      this.stopUrlSync();
      oldDashboardWrapper.destroy();
      dashboardWatcher.leave();
    };
  }

  public startUrlSync() {
    if (!this.state.meta.isEmbedded) {
      getUrlSyncManager().initSync(this);
    }
  }

  public stopUrlSync() {
    getUrlSyncManager().cleanUp(this);
  }

  public onEnterEditMode = () => {
    // Save this state
    this._initialState = sceneUtils.cloneSceneObjectState(this.state);
    this._initialUrlState = locationService.getLocation();

    // Switch to edit mode
    this.setState({ isEditing: true });

    // Propagate change edit mode change to children
    this.propagateEditModeChange();

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

  public exitEditMode({ skipConfirm, restoreIntialState }: { skipConfirm: boolean; restoreIntialState?: boolean }) {
    if (!this.canDiscard()) {
      console.error('Trying to discard back to a state that does not exist, initialState undefined');
      return;
    }

    if (!this.state.isDirty || skipConfirm) {
      this.exitEditModeConfirmed(restoreIntialState || this.state.isDirty);
      return;
    }

    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Discard changes to dashboard?',
        text: `You have unsaved changes to this dashboard. Are you sure you want to discard them?`,
        icon: 'trash-alt',
        yesText: 'Discard',
        onConfirm: this.exitEditModeConfirmed.bind(this),
      })
    );
  }

  private exitEditModeConfirmed(restoreIntialState = true) {
    // No need to listen to changes anymore
    this._changeTracker.stopTrackingChanges();
    // Stop url sync before updating url
    this.stopUrlSync();

    // Now we can update urls
    // We are updating url and removing editview and editPanel.
    // The initial url may be including edit view, edit panel or inspect query params if the user pasted the url,
    // hence we need to cleanup those query params to get back to the dashboard view. Otherwise url sync can trigger overlays.
    locationService.replace(
      locationUtil.getUrlForPartial(this._initialUrlState!, {
        editPanel: null,
        editview: null,
        inspect: null,
        inspectTab: null,
      })
    );

    if (restoreIntialState) {
      //  Restore initial state and disable editing
      this.setState({ ...this._initialState, isEditing: false });
    } else {
      // Do not restore
      this.setState({ isEditing: false });
    }
    // and start url sync again
    this.startUrlSync();
    // Disable grid dragging
    this.propagateEditModeChange();
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

    this._initialState = newState;
    this.exitEditMode({ skipConfirm: false, restoreIntialState: true });

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

    let pageNav: NavModelItem = {
      text: this.state.title,
      url: getDashboardUrl({
        uid: this.state.uid,
        slug: meta.slug,
        currentQueryParams: location.search,
        updateQuery: { viewPanel: null, inspect: null, editview: null, editPanel: null, tab: null },
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
    const newGridItem = new SceneGridItem({
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

  public duplicatePanel(vizPanel: VizPanel) {
    if (!vizPanel.parent) {
      return;
    }

    const libraryPanel = getLibraryVizPanelFromVizPanel(vizPanel);

    const gridItem = libraryPanel ? libraryPanel.parent : vizPanel.parent;

    if (!(gridItem instanceof SceneGridItem || gridItem instanceof PanelRepeaterGridItem)) {
      console.error('Trying to duplicate a panel in a layout that is not SceneGridItem or PanelRepeaterGridItem');
      return;
    }

    let panelState;
    let panelData;
    let newGridItem;
    const newPanelId = dashboardSceneGraph.getNextPanelId(this);

    if (libraryPanel) {
      const gridItemToDuplicateState = sceneUtils.cloneSceneObjectState(gridItem.state);

      newGridItem = new SceneGridItem({
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
      if (gridItem instanceof PanelRepeaterGridItem) {
        panelState = sceneUtils.cloneSceneObjectState(gridItem.state.source.state);
        panelData = sceneGraph.getData(gridItem.state.source).clone();
      } else {
        panelState = sceneUtils.cloneSceneObjectState(vizPanel.state);
        panelData = sceneGraph.getData(vizPanel).clone();
      }

      // when we duplicate a panel we don't want to clone the alert state
      delete panelData.state.data?.alertState;

      newGridItem = new SceneGridItem({
        x: gridItem.state.x,
        y: gridItem.state.y,
        height: NEW_PANEL_HEIGHT,
        width: NEW_PANEL_WIDTH,
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

    const jsonData = gridItemToPanel(gridItem);

    store.set(LS_PANEL_COPY_KEY, JSON.stringify(jsonData));
    appEvents.emit(AppEvents.alertSuccess, ['Panel copied. Use **Paste panel** toolbar action to paste.']);
    this.setState({ hasCopiedPanel: true });
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

    if (!(gridItem instanceof SceneGridItem) && !(gridItem instanceof PanelRepeaterGridItem)) {
      throw new Error('Cannot paste invalid grid item');
    }

    const panelId = dashboardSceneGraph.getNextPanelId(this);

    if (gridItem instanceof SceneGridItem && gridItem.state.body instanceof LibraryVizPanel) {
      const panelKey = getVizPanelKeyForPanelId(panelId);

      gridItem.state.body.setState({ panelKey });

      const vizPanel = gridItem.state.body.state.panel;

      if (vizPanel instanceof VizPanel) {
        vizPanel.setState({ key: panelKey });
      }
    } else if (gridItem instanceof SceneGridItem && gridItem.state.body) {
      gridItem.state.body.setState({
        key: getVizPanelKeyForPanelId(panelId),
      });
    } else if (gridItem instanceof PanelRepeaterGridItem) {
      gridItem.state.source.setState({
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

    this.setState({ hasCopiedPanel: false });
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
      row.forEachChild((child: SceneObject) => {
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

    if (!(gridItem instanceof SceneGridItem || gridItem instanceof PanelRepeaterGridItem)) {
      console.error('Trying to duplicate a panel in a layout that is not SceneGridItem or PanelRepeaterGridItem');
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

  public onCreateLibPanelWidget() {
    if (!(this.state.body instanceof SceneGridLayout)) {
      throw new Error('Trying to add a panel in a layout that is not SceneGridLayout');
    }

    const sceneGridLayout = this.state.body;

    const panelId = dashboardSceneGraph.getNextPanelId(this);

    const newGridItem = new SceneGridItem({
      height: NEW_PANEL_HEIGHT,
      width: NEW_PANEL_WIDTH,
      x: 0,
      y: 0,
      body: new AddLibraryPanelWidget({ key: getVizPanelKeyForPanelId(panelId) }),
      key: `grid-item-${panelId}`,
    });

    sceneGridLayout.setState({
      children: [newGridItem, ...sceneGridLayout.state.children],
    });
  }

  public onCreateNewRow() {
    const row = getDefaultRow(this);

    this.addRow(row);

    return getPanelIdForVizPanel(row);
  }

  public onCreateNewPanel(): number {
    const vizPanel = getDefaultVizPanel(this);

    this.addPanel(vizPanel);

    return getPanelIdForVizPanel(vizPanel);
  }

  /**
   * Called by the SceneQueryRunner to privide contextural parameters (tracking) props for the request
   */
  public enrichDataRequest(sceneObject: SceneObject): Partial<DataQueryRequest> {
    const panel = getClosestVizPanel(sceneObject);
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
}

export class DashboardVariableDependency implements SceneVariableDependencyConfigLike {
  private _emptySet = new Set<string>();

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
  }
}
