import * as H from 'history';
import { Unsubscribable } from 'rxjs';

import { AppEvents, CoreApp, DataQueryRequest, NavIndex, NavModelItem, locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  dataLayers,
  getUrlSyncManager,
  SceneDataLayers,
  SceneFlexLayout,
  sceneGraph,
  SceneGridItem,
  SceneGridLayout,
  SceneGridRow,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectStateChangedEvent,
  SceneRefreshPicker,
  SceneTimeRange,
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
import { SaveDashboardDrawer } from '../saving/SaveDashboardDrawer';
import { DashboardSceneRenderer } from '../scene/DashboardSceneRenderer';
import { buildGridItemForPanel, transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { gridItemToPanel } from '../serialization/transformSceneToSaveModel';
import { DecoratedRevisionModel } from '../settings/VersionsEditView';
import { DashboardEditView } from '../settings/utils';
import { historySrv } from '../settings/version-history';
import { DashboardModelCompatibilityWrapper } from '../utils/DashboardModelCompatibilityWrapper';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
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
import { PanelRepeaterGridItem } from './PanelRepeaterGridItem';
import { ViewPanelScene } from './ViewPanelScene';
import { setupKeyboardShortcuts } from './keyboardShortcuts';

export const PERSISTED_PROPS = ['title', 'description', 'tags', 'editable', 'graphTooltip', 'links'];

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
   * change tracking subscription
   */
  private _changeTrackerSub?: Unsubscribable;

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

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    let prevSceneContext = window.__grafanaSceneContext;

    window.__grafanaSceneContext = this;

    if (this.state.isEditing) {
      this.startTrackingChanges();
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
      this.stopTrackingChanges();
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
    this.startTrackingChanges();
  };

  public saveCompleted(saveModel: Dashboard, result: SaveDashboardResponseDTO, folderUid?: string) {
    this._initialSaveModel = {
      ...saveModel,
      id: result.id,
      uid: result.uid,
      version: result.version,
    };

    this.stopTrackingChanges();
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
    this.startTrackingChanges();
  }

  private propagateEditModeChange() {
    if (this.state.body instanceof SceneGridLayout) {
      this.state.body.setState({ isDraggable: this.state.isEditing, isResizable: this.state.isEditing });
      forceRenderChildren(this.state.body, true);
    }
  }

  public exitEditMode({ skipConfirm }: { skipConfirm: boolean }) {
    if (!this.canDiscard()) {
      console.error('Trying to discard back to a state that does not exist, initialState undefined');
      return;
    }

    if (!this.state.isDirty || skipConfirm) {
      this.exitEditModeConfirmed();
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

  private exitEditModeConfirmed() {
    // No need to listen to changes anymore
    this.stopTrackingChanges();
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

    // locationService.replace({ pathname: this._initialUrlState?.pathname, search: this._initialUrlState?.search });
    // Update state and disable editing
    this.setState({ ...this._initialState, isEditing: false });
    // and start url sync again
    this.startUrlSync();
    // Disable grid dragging
    this.propagateEditModeChange();
  }

  public canDiscard() {
    return this._initialState !== undefined;
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
    this.exitEditMode({ skipConfirm: false });

    return true;
  };

  public openSaveDrawer({ saveAsCopy }: { saveAsCopy?: boolean }) {
    if (!this.state.isEditing) {
      return;
    }

    this.setState({
      overlay: new SaveDashboardDrawer({
        dashboardRef: this.getRef(),
        saveAsCopy,
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

  private startTrackingChanges() {
    this._changeTrackerSub = this.subscribeToEvent(
      SceneObjectStateChangedEvent,
      (event: SceneObjectStateChangedEvent) => {
        if (event.payload.changedObject instanceof SceneRefreshPicker) {
          if (Object.prototype.hasOwnProperty.call(event.payload.partialUpdate, 'intervals')) {
            this.setIsDirty();
          }
        }
        if (event.payload.changedObject instanceof SceneDataLayers) {
          this.setIsDirty();
        }
        if (event.payload.changedObject instanceof dataLayers.AnnotationsDataLayer) {
          if (!Object.prototype.hasOwnProperty.call(event.payload.partialUpdate, 'data')) {
            this.setIsDirty();
          }
        }
        if (event.payload.changedObject instanceof SceneGridItem) {
          this.setIsDirty();
        }
        if (event.payload.changedObject instanceof DashboardScene) {
          if (Object.keys(event.payload.partialUpdate).some((key) => PERSISTED_PROPS.includes(key))) {
            this.setIsDirty();
          }
        }
        if (event.payload.changedObject instanceof SceneTimeRange) {
          this.setIsDirty();
        }
        if (event.payload.changedObject instanceof DashboardControls) {
          if (Object.prototype.hasOwnProperty.call(event.payload.partialUpdate, 'hideTimeControls')) {
            this.setIsDirty();
          }
        }
      }
    );
  }

  private setIsDirty() {
    if (!this.state.isDirty) {
      this.setState({ isDirty: true });
    }
  }

  private stopTrackingChanges() {
    this._changeTrackerSub?.unsubscribe();
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

    const gridItem = vizPanel.parent;

    if (!(gridItem instanceof SceneGridItem || gridItem instanceof PanelRepeaterGridItem)) {
      console.error('Trying to duplicate a panel in a layout that is not SceneGridItem or PanelRepeaterGridItem');
      return;
    }

    let panelState;
    let panelData;
    if (gridItem instanceof PanelRepeaterGridItem) {
      const { key, ...gridRepeaterSourceState } = sceneUtils.cloneSceneObjectState(gridItem.state.source.state);
      panelState = { ...gridRepeaterSourceState };
      panelData = sceneGraph.getData(gridItem.state.source).clone();
    } else {
      const { key, ...gridItemPanelState } = sceneUtils.cloneSceneObjectState(vizPanel.state);
      panelState = { ...gridItemPanelState };
      panelData = sceneGraph.getData(vizPanel).clone();
    }

    // when we duplicate a panel we don't want to clone the alert state
    delete panelData.state.data?.alertState;

    const { key: gridItemKey, ...gridItemToDuplicateState } = sceneUtils.cloneSceneObjectState(gridItem.state);

    const newGridItem = new SceneGridItem({
      ...gridItemToDuplicateState,
      body: new VizPanel({ ...panelState, $data: panelData }),
    });

    if (!(this.state.body instanceof SceneGridLayout)) {
      console.error('Trying to duplicate a panel in a layout that is not SceneGridLayout ');
      return;
    }

    const sceneGridLayout = this.state.body;

    sceneGridLayout.setState({
      children: [...sceneGridLayout.state.children, newGridItem],
    });
  }

  public copyPanel(vizPanel: VizPanel) {
    if (!vizPanel.parent) {
      return;
    }

    const gridItem = vizPanel.parent;

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

    const gridItem = buildGridItemForPanel(panelModel);
    const sceneGridLayout = this.state.body;

    if (!(gridItem instanceof SceneGridItem) && !(gridItem instanceof PanelRepeaterGridItem)) {
      throw new Error('Cannot paste invalid grid item');
    }

    const panelId = dashboardSceneGraph.getNextPanelId(this);

    if (gridItem instanceof SceneGridItem && gridItem.state.body) {
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
