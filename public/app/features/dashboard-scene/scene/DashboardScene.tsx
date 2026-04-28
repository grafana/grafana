import type * as H from 'history';

import {
  CoreApp,
  type DataQueryRequest,
  type FieldConfig,
  type FieldConfigSource,
  filterFieldConfigOverrides,
  isStandardFieldProp,
  locationUtil,
  type NavIndex,
  type NavModelItem,
  store,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, locationService, RefreshEvent } from '@grafana/runtime';
import { getPanelPluginMeta } from '@grafana/runtime/internal';
import {
  SceneDataTransformer,
  sceneGraph,
  type SceneObject,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  SceneQueryRunner,
  SceneTimeRange,
  sceneUtils,
  type SceneVariable,
  type SceneVariableDependencyConfigLike,
  type VizPanel,
} from '@grafana/scenes';
import { type Dashboard, type DashboardLink, type LibraryPanel } from '@grafana/schema';
import { type Spec as DashboardV2Spec, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { appEvents } from 'app/core/app_events';
import { type ScrollRefElement } from 'app/core/components/NativeScrollbar';
import { LS_PANEL_COPY_KEY, LS_STYLES_COPY_KEY } from 'app/core/constants';
import { getNavModel } from 'app/core/selectors/navModel';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { type SaveDashboardAsOptions } from 'app/features/dashboard/components/SaveDashboard/types';
import { getDashboardSceneProfiler } from 'app/features/dashboard/services/DashboardProfiler';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel, type ScopeMeta } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { type DecoratedRevisionModel } from 'app/features/dashboard/types/revisionModels';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { type DashboardJson } from 'app/features/manage-dashboards/types';
import { VariablesChanged } from 'app/features/variables/types';
import { type DashboardDTO, type DashboardMeta, type SaveDashboardResponseDTO } from 'app/types/dashboard';
import { DashboardDiscardedEvent, ShowConfirmModalEvent } from 'app/types/events';

import {
  AnnoKeyManagerAllowsEdits,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  ManagerKind,
  type ResourceForCreate,
} from '../../apiserver/types';
import { DashboardEditPane } from '../edit-pane/DashboardEditPane';
import { dashboardEditActions } from '../edit-pane/shared';
import { type PanelEditor } from '../panel-edit/PanelEditor';
import { getUpdatedHoverHeader } from '../panel-edit/getPanelFrameOptions';
import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';
import { SaveDashboardDrawer } from '../saving/SaveDashboardDrawer';
import { type DashboardChangeInfo } from '../saving/shared';
import {
  type DashboardSceneSerializerLike,
  getDashboardSceneSerializer,
  V2DashboardSerializer,
} from '../serialization/DashboardSceneSerializer';
import { serializeAutoGridItem } from '../serialization/layoutSerializers/AutoGridLayoutSerializer';
import { gridItemToGridLayoutItemKind } from '../serialization/layoutSerializers/DefaultGridLayoutSerializer';
import { getElement } from '../serialization/layoutSerializers/utils';
import {
  createSceneVariableFromVariableModel as createSceneVariableFromVariableModelV2,
  transformSaveModelSchemaV2ToScene,
} from '../serialization/transformSaveModelSchemaV2ToScene';
import { buildGridItemForPanel, transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { gridItemToPanel } from '../serialization/transformSceneToSaveModel';
import { normalizeTransformation } from '../serialization/transformationCompat';
import { JsonModelEditView } from '../settings/JsonModelEditView';
import { type DashboardEditView } from '../settings/utils';
import { DashboardModelCompatibilityWrapper } from '../utils/DashboardModelCompatibilityWrapper';
import { isRepeatCloneOrChildOf } from '../utils/clone';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { djb2Hash } from '../utils/djb2Hash';
import { getDashboardUrl } from '../utils/getDashboardUrl';
import { DashboardInteractions } from '../utils/interactions';
import { getPanelStyleConfig, type PanelStyleConfig } from '../utils/panelStyleConfigs';
import {
  getClosestVizPanel,
  getDashboardSceneFor,
  getDefaultVizPanel,
  getLayoutForObject,
  getLayoutManagerFor,
  getPanelIdForVizPanel,
  hasActualSaveChanges,
} from '../utils/utils';

import { AddLibraryPanelDrawer } from './AddLibraryPanelDrawer';
import { type DashboardControls } from './DashboardControls';
import { DashboardLayoutOrchestrator } from './DashboardLayoutOrchestrator';
import { createMutationClient } from './DashboardMutationClientSetter';
import { DashboardSceneRenderer } from './DashboardSceneRenderer';
import { DashboardSceneUrlSync } from './DashboardSceneUrlSync';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';
import { PulseDrawer } from './PulseDrawer';
import { setupKeyboardShortcuts } from './keyboardShortcuts';
import { AutoGridItem } from './layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { addNewRowTo } from './layouts-shared/addNew';
import { clearClipboard } from './layouts-shared/paste';
import { type DashboardLayoutManager } from './types/DashboardLayoutManager';
import { type LayoutParent } from './types/LayoutParent';

export const PERSISTED_PROPS = ['title', 'description', 'tags', 'editable', 'graphTooltip', 'links', 'meta', 'preload'];
export const PANEL_SEARCH_VAR = 'systemPanelFilterVar';
export const PANELS_PER_ROW_VAR = 'systemDynamicRowSizeVar';

type PanelStyles = {
  fieldConfig?: { defaults: Partial<FieldConfig> };
  options?: Record<string, unknown>;
};

type CopiedPanelStyles = {
  panelType: string;
  styles: PanelStyles;
};

function copyFieldConfigPropIfDefined<K extends keyof FieldConfig>(
  source: FieldConfig,
  target: Partial<FieldConfig>,
  key: K
): void {
  const value = source[key];
  if (value !== undefined) {
    target[key] = value;
  }
}

function extractOptionProps(source: Record<string, unknown>, props: readonly string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (props.includes(key) && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export interface DashboardScenePreferences {
  defaultLayoutTemplate?: DashboardLayoutManager;
}

export interface DashboardSceneState extends SceneObjectState {
  /** Dashboard-specific preferences **/
  preferences?: DashboardScenePreferences;

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
  /** @experimental */
  scopeMeta?: ScopeMeta;
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
  meta: Omit<DashboardMeta, 'isNew'>;
  /** Version of the dashboard */
  version?: number;
  /** Panel to inspect */
  inspectPanelKey?: string;
  /** Panel key to view in fullscreen */
  viewPanel?: string;
  /** Edit view */
  editview?: DashboardEditView;
  /** Edit panel */
  editPanel?: PanelEditor;
  /** Scene object that handles the current drawer or modal */
  overlay?: SceneObject;
  /** Share view */
  shareView?: string;
  /** Renders panels in grid and filtered */
  panelSearch?: string;
  /** How many panels to show per row for search results */
  panelsPerRow?: number;
  /** options pane */
  editPane: DashboardEditPane;
  /** Manages dragging/dropping of layout items */
  layoutOrchestrator: DashboardLayoutOrchestrator;
  /** True while default variables from datasources are being loaded */
  defaultVariablesLoading?: boolean;
  /** True while default links from datasources are being loaded */
  defaultLinksLoading?: boolean;
}

export class DashboardScene extends SceneObjectBase<DashboardSceneState> implements LayoutParent {
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
   * Remember scroll position when going into panel edit
   */
  private _scrollRef?: ScrollRefElement;
  private _prevScrollPos?: number;

  protected _renderBeforeActivation = true;

  public serializer: DashboardSceneSerializerLike<
    Dashboard | DashboardV2Spec,
    DashboardMeta | DashboardWithAccessInfo<DashboardV2Spec>['metadata'],
    Dashboard | DashboardV2Spec,
    DashboardJson | DashboardV2Spec
  >;

  public constructor(state: Partial<DashboardSceneState>, serializerVersion: 'v1' | 'v2' = 'v1') {
    super({
      title: t('dashboard-scene.dashboard-scene.title.dashboard', 'Dashboard'),
      meta: {},
      editable: true,
      $timeRange: state.$timeRange ?? new SceneTimeRange({}),
      body:
        state.body ?? state.preferences?.defaultLayoutTemplate?.clone() ?? DefaultGridLayoutManager.fromVizPanels([]),
      links: state.links ?? [],
      ...state,
      editPane: new DashboardEditPane(),
      layoutOrchestrator: new DashboardLayoutOrchestrator(),
      preferences: state.preferences ?? {},
    });

    this.serializer =
      serializerVersion === 'v2' ? getDashboardSceneSerializer('v2') : getDashboardSceneSerializer('v1');

    this._changeTracker = new DashboardSceneChangeTracker(this);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    let prevSceneContext = window.__grafanaSceneContext;
    const isNew = locationService.getLocation().pathname === '/dashboard/new';

    window.__grafanaSceneContext = this;

    this._initializePanelSearch();

    if (this.state.isEditing) {
      this._initialUrlState = locationService.getLocation();
      this._changeTracker.startTrackingChanges();
    }

    if (isNew) {
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

    const destroyMutationClient = createMutationClient(this);

    return () => {
      destroyMutationClient();
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

  public setDefaultVariables(defaultVariables: VariableKind[]) {
    const variableSet = sceneGraph.getVariables(this);
    const userVars = variableSet.state.variables.filter((v) => !v.state.origin);
    const defaultVarObjects = defaultVariables
      .map((v) => {
        try {
          return createSceneVariableFromVariableModelV2(v);
        } catch (err) {
          console.error(err);
          return null;
        }
      })
      .filter((v): v is SceneVariable => Boolean(v));

    variableSet.setState({ variables: [...defaultVarObjects, ...userVars] });
  }

  public setDefaultLinks(defaultLinks: DashboardLink[]) {
    const userLinks = this.state.links.filter((l) => !l.origin);
    this.setState({ links: [...defaultLinks, ...userLinks] });
  }

  public clearDefaultControls() {
    const variableSet = sceneGraph.getVariables(this);
    const nonDefaultVars = variableSet.state.variables.filter((v) => !v.state.origin);
    variableSet.setState({ variables: nonDefaultVars });

    const nonDefaultLinks = this.state.links.filter((l) => !l.origin);
    this.setState({ links: nonDefaultLinks });
  }

  public onEnterEditMode = () => {
    // Save this state
    this._initialState = sceneUtils.cloneSceneObjectState(this.state, { isDirty: false });
    this._initialUrlState = locationService.getLocation();

    // Switch to edit mode
    this.setState({ isEditing: true, editable: true });

    // Propagate change edit mode change to children
    this.state.body.editModeChanged?.(true);

    this._changeTracker.startTrackingChanges();
  };

  public saveCompleted(saveModel: Dashboard | DashboardV2Spec, result: SaveDashboardResponseDTO, folderUid?: string) {
    this.serializer.onSaveComplete(saveModel, result);

    this._changeTracker.stopTrackingChanges();

    this.setState({
      version: result.version,
      isDirty: false,
      uid: result.uid,
      meta: {
        ...this.state.meta,
        uid: result.uid,
        url: result.url,
        slug: result.slug,
        folderUid: folderUid,
        version: result.version,
      },
      overlay: undefined,
    });

    this.state.editPanel?.dashboardSaved();

    this._initialState = sceneUtils.cloneSceneObjectState(this.state);
    this._initialUrlState = locationService.getLocation();

    this._changeTracker.startTrackingChanges();
  }

  public exitEditMode({ skipConfirm, restoreInitialState }: { skipConfirm: boolean; restoreInitialState?: boolean }) {
    if (!this.canDiscard()) {
      console.error('Trying to discard back to a state that does not exist, initialState undefined');
      return;
    }

    if (!this.state.isDirty || skipConfirm || !hasActualSaveChanges(this) || this.managedResourceCannotBeEdited()) {
      this.exitEditModeConfirmed(restoreInitialState || this.state.isDirty);
      return;
    }

    if (config.featureToggles.dashboardNewLayouts) {
      const canSave = Boolean(this.state.meta.canSave);

      appEvents.publish(
        new ShowConfirmModalEvent({
          title: t('dashboard-scene.dashboard-scene.modal.title.unsaved-changes', 'Unsaved changes'),
          text: t(
            'dashboard-scene.dashboard-scene.modal.text.save-changes-question',
            'Do you want to save your changes?'
          ),
          altActionText: canSave ? t('dashboard-scene.dashboard-scene.modal.save', 'Save') : undefined,
          noText: t('dashboard-scene.dashboard-scene.modal.cancel', 'Cancel'),
          yesText: t('dashboard-scene.dashboard-scene.modal.discard', 'Discard'),
          yesButtonVariant: 'destructive',
          onAltAction: canSave
            ? () => {
                this.openSaveDrawer({
                  onSaveSuccess: () => {
                    this.exitEditModeConfirmed(false);
                  },
                });
              }
            : undefined,
          onConfirm: () => {
            this.exitEditModeConfirmed();
          },
        })
      );
    } else {
      appEvents.publish(
        new ShowConfirmModalEvent({
          title: t(
            'dashboard-scene.dashboard-scene.title.discard-changes-to-dashboard',
            'Discard changes to dashboard?'
          ),
          text: t(
            'dashboard-scene.dashboard-scene.title.unsaved-changes-question',
            'You have unsaved changes to this dashboard. Are you sure you want to discard them?'
          ),
          yesText: t('dashboard-scene.dashboard-scene.modal.discard', 'Discard'),
          onConfirm: () => {
            this.exitEditModeConfirmed();
          },
        })
      );
    }
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
      appEvents.publish(new DashboardDiscardedEvent());
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
    this.state.body.editModeChanged?.(false);
  }

  public canDiscard() {
    return this._initialState !== undefined;
  }

  /**
   * Discard changes and revert to the last saved state, while keeping edit mode enabled.
   * This is useful for flows where you want to continue an action (for example share/export)
   * without forcing the user to exit edit mode.
   */
  public discardChangesAndKeepEditing() {
    if (!this.canDiscard()) {
      console.error('Trying to discard back to a state that does not exist, initialState undefined');
      return;
    }

    // Stop tracking while we reset state.
    this._changeTracker.stopTrackingChanges();

    const restoredState = sceneUtils.cloneSceneObjectState(this._initialState!, { isDirty: false });

    // Ensure the restored layout stays editable.
    restoredState.body.editModeChanged?.(true);

    this.setState({
      ...restoredState,
      isEditing: true,
      editable: true,
      isDirty: false,
      editPanel: undefined,
      editview: undefined,
      overlay: undefined,
    });

    this._changeTracker.startTrackingChanges();
  }

  public pauseTrackingChanges() {
    this._changeTracker.stopTrackingChanges();
  }

  public resumeTrackingChanges() {
    this._changeTracker.startTrackingChanges();
  }

  public onRestore = async (version: DecoratedRevisionModel): Promise<boolean> => {
    const api = await getDashboardAPI();
    // the id here is the resource version in k8s, use this instead to get the specific version
    const versionRsp = await api.restoreDashboardVersion(version.uid, version.id);

    if (!Number.isInteger(versionRsp.version)) {
      return false;
    }

    let dashScene: DashboardScene;

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    if (isDashboardV2Spec(version.data as Dashboard | DashboardV2Spec)) {
      const api = await getDashboardAPI('v2');
      const dto = await api.getDashboardDTO(version.uid);
      dashScene = transformSaveModelSchemaV2ToScene(dto);
    } else {
      const dashboardDTO: DashboardDTO = {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- v1 restore path requires Dashboard type
        dashboard: new DashboardModel(version.data as Dashboard),
        meta: this.state.meta,
      };

      dashScene = transformSaveModelToScene(dashboardDTO);
    }

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
        showVariablesWarning: this.hasVariableErrors(),
      }),
    });
  }

  public getPageNav(location: H.Location, navIndex: NavIndex) {
    const { meta, viewPanel, editPanel, title, uid } = this.state;
    const isNew = !Boolean(uid);

    let pageNav: NavModelItem = {
      text: title,
      url: getDashboardUrl({
        uid,
        slug: meta.slug,
        currentQueryParams: location.search,
        updateQuery: { viewPanel: null, inspect: null, editview: null, editPanel: null, tab: null, shareView: null },
        isHomeDashboard: !meta.url && !meta.slug && !isNew && !meta.isSnapshot,
        isSnapshot: meta.isSnapshot,
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

    if (viewPanel) {
      pageNav = {
        text: t('dashboard-scene.dashboard-scene.text.view-panel', 'View panel'),
        parentItem: pageNav,
        url: locationUtil.getUrlForPartial(locationService.getLocation(), {
          viewPanel: viewPanel,
          editPanel: undefined,
        }),
      };
    }

    if (editPanel) {
      pageNav = {
        text: t('dashboard-scene.dashboard-scene.text.edit-panel', 'Edit panel'),
        parentItem: pageNav,
      };
    }

    return pageNav;
  }

  public getInitialState(): DashboardSceneState | undefined {
    return this._initialState;
  }

  public addPanel(vizPanel: VizPanel): void {
    if (!this.state.isEditing) {
      this.onEnterEditMode();
    }

    // Add panel to layout
    this.state.body.addPanel(vizPanel);
  }

  public createLibraryPanel(panelToReplace: VizPanel, libPanel: LibraryPanel) {
    const behavior = new LibraryPanelBehavior({ uid: libPanel.uid, name: libPanel.name });

    const parent = panelToReplace.parent;

    if (parent instanceof DashboardGridItem) {
      const body = panelToReplace.clone({
        $behaviors: [behavior],
      });
      parent.setState({ body });
      return;
    }

    if (parent instanceof AutoGridItem) {
      // Auto grid only supports creating library panels from the source panel (AutoGridItem.state.body).
      const body = parent.state.body.clone({
        $behaviors: [behavior],
      });
      parent.setState({ body });
      parent.handleEditChange();
      return;
    }

    throw new Error("Trying to replace a panel that doesn't have a parent layout item");
  }

  public duplicatePanel(vizPanel: VizPanel) {
    getLayoutManagerFor(vizPanel).duplicatePanel?.(vizPanel);
  }

  public copyPanel(vizPanel: VizPanel) {
    if (config.featureToggles.dashboardNewLayouts) {
      const gridItem = vizPanel.parent;

      if (gridItem instanceof AutoGridItem) {
        const elements = getElement(gridItem, this);
        const gridItemKind = serializeAutoGridItem(gridItem);

        clearClipboard();
        store.set(LS_PANEL_COPY_KEY, JSON.stringify({ elements, gridItem: gridItemKind }));
      } else if (gridItem instanceof DashboardGridItem) {
        const elements = getElement(gridItem, this);
        const gridItemKind = gridItemToGridLayoutItemKind(gridItem);

        clearClipboard();
        store.set(LS_PANEL_COPY_KEY, JSON.stringify({ elements, gridItem: gridItemKind }));
      } else {
        console.error('Trying to copy a panel that is not DashboardGridItem child');
        throw new Error('Trying to copy a panel that is not DashboardGridItem child');
      }
      return;
    }

    if (!vizPanel.parent) {
      return;
    }

    let gridItem = vizPanel.parent;

    if (!(gridItem instanceof DashboardGridItem)) {
      console.error('Trying to copy a panel that is not DashboardGridItem child');
      throw new Error('Trying to copy a panel that is not DashboardGridItem child');
    }

    const jsonData = gridItemToPanel(gridItem);

    clearClipboard();
    store.set(LS_PANEL_COPY_KEY, JSON.stringify(jsonData));
  }

  public pastePanel() {
    if (config.featureToggles.dashboardNewLayouts) {
      const layout = getLayoutForObject(this);
      if (layout) {
        layout.pastePanel();
        return;
      }
    }

    const jsonData = store.get(LS_PANEL_COPY_KEY);
    const jsonObj = JSON.parse(jsonData);
    const panelModel = new PanelModel(jsonObj);
    const gridItem = buildGridItemForPanel(panelModel);
    const panel = gridItem.state.body;

    this.addPanel(panel);

    store.delete(LS_PANEL_COPY_KEY);
  }

  /** @internal */
  private static extractPanelStyles(panel: VizPanel, styleConfig: PanelStyleConfig): PanelStyles {
    const styles: PanelStyles = {};

    if (!panel.state.fieldConfig?.defaults) {
      return styles;
    }

    styles.fieldConfig = { defaults: {} };

    const defaults = styles.fieldConfig.defaults;
    const panelDefaults = panel.state.fieldConfig.defaults;

    // default props (color)
    for (const key of styleConfig.fieldConfig.defaultsProps) {
      copyFieldConfigPropIfDefined(panelDefaults, defaults, key);
    }

    // custom props (lineWidth, fillOpacity, etc.)
    if (panel.state.fieldConfig.defaults.custom) {
      const customDefaults: Record<string, unknown> = {};
      const panelCustom: Record<string, unknown> = panel.state.fieldConfig.defaults.custom;

      for (const key of styleConfig.fieldConfig.customProps) {
        const value = panelCustom[key];
        if (value !== undefined) {
          customDefaults[key] = value;
        }
      }

      defaults.custom = customDefaults;
    }

    // panel-level options (colorMode, graphMode, textMode, etc.)
    if (styleConfig.options?.props && panel.state.options) {
      const extracted = extractOptionProps(panel.state.options, styleConfig.options.props);
      if (Object.keys(extracted).length > 0) {
        styles.options = extracted;
      }
    }

    return styles;
  }

  /** @internal */
  public copyPanelStyles(vizPanel: VizPanel) {
    if (!config.featureToggles.panelStyleActions) {
      return;
    }

    const panelType = vizPanel.state.pluginId;
    const styleConfig = getPanelStyleConfig(panelType);

    if (!styleConfig) {
      return;
    }

    const stylesToCopy: CopiedPanelStyles = {
      panelType,
      styles: DashboardScene.extractPanelStyles(vizPanel, styleConfig),
    };

    store.set(LS_STYLES_COPY_KEY, JSON.stringify(stylesToCopy));
    appEvents.emit('alert-success', ['Panel styles copied.']);
  }

  /** @internal */
  public static hasPanelStylesToPaste(panelType: string): boolean {
    if (!config.featureToggles.panelStyleActions) {
      return false;
    }

    const stylesJson = store.get(LS_STYLES_COPY_KEY);
    if (!stylesJson) {
      return false;
    }

    try {
      const stylesCopy: CopiedPanelStyles = JSON.parse(stylesJson);
      return stylesCopy.panelType === panelType;
    } catch (e) {
      return false;
    }
  }

  /** @internal */
  public pastePanelStyles(vizPanel: VizPanel) {
    if (!config.featureToggles.panelStyleActions) {
      return;
    }

    const stylesJson = store.get(LS_STYLES_COPY_KEY);
    if (!stylesJson) {
      return;
    }

    try {
      const stylesCopy: CopiedPanelStyles = JSON.parse(stylesJson);

      const panelType = vizPanel.state.pluginId;

      if (stylesCopy.panelType !== panelType) {
        return;
      }

      if (stylesCopy.styles.fieldConfig?.defaults) {
        const newDefaults = {
          ...vizPanel.state.fieldConfig?.defaults,
          ...stylesCopy.styles.fieldConfig.defaults,
        };

        if (stylesCopy.styles.fieldConfig.defaults.custom) {
          newDefaults.custom = {
            ...vizPanel.state.fieldConfig?.defaults?.custom,
            ...stylesCopy.styles.fieldConfig.defaults.custom,
          };
        }

        vizPanel.onFieldConfigChange({
          ...vizPanel.state.fieldConfig,
          defaults: newDefaults,
        });
      }

      if (stylesCopy.styles.options) {
        vizPanel.onOptionsChange({
          ...vizPanel.state.options,
          ...stylesCopy.styles.options,
        });
      }

      appEvents.emit('alert-success', ['Panel styles applied.']);
    } catch (e) {
      console.error('Error pasting panel styles:', e);
      appEvents.emit('alert-error', ['Error pasting panel styles.']);
      DashboardInteractions.panelStylesMenuClicked(
        'paste',
        vizPanel.state.pluginId,
        getPanelIdForVizPanel(vizPanel) ?? -1,
        true
      );
    }
  }

  public removePanel(panel: VizPanel) {
    getLayoutManagerFor(panel).removePanel?.(panel);
  }

  public updatePanelTitle(panel: VizPanel, title: string) {
    panel.setState({ title, hoverHeader: getUpdatedHoverHeader(title, panel.state.$timeRange) });
  }

  public async changePanelPlugin(
    panel: VizPanel,
    newPluginId: string,
    newOptions?: Record<string, unknown>,
    newFieldConfig?: FieldConfigSource
  ) {
    const { fieldConfig: prevFieldConfig } = panel.state;

    let cleanFieldConfig: FieldConfigSource = {
      defaults: { ...prevFieldConfig.defaults, custom: {} },
      overrides: filterFieldConfigOverrides(prevFieldConfig.overrides, isStandardFieldProp),
    };

    if (newFieldConfig) {
      cleanFieldConfig = { ...newFieldConfig, overrides: cleanFieldConfig.overrides };
    }

    await panel.changePluginType(newPluginId, newOptions, cleanFieldConfig);

    if (newOptions) {
      panel.onOptionsChange(newOptions, true);
    }

    if (newFieldConfig) {
      panel.onFieldConfigChange({ ...newFieldConfig, overrides: cleanFieldConfig.overrides }, true);
    }

    const pluginMeta = await getPanelPluginMeta(newPluginId);
    const skipDataQuery = pluginMeta?.skipDataQuery ?? false;

    if (skipDataQuery && panel.state.$data) {
      panel.setState({ $data: undefined });
    }

    if (!skipDataQuery && !panel.state.$data) {
      panel.setState({
        $data: new SceneDataTransformer({
          $data: new SceneQueryRunner({
            datasource: { uid: config.defaultDatasource },
            queries: [{ refId: 'A' }],
          }),
          transformations: [],
        }),
      });
    }
  }

  public unlinkLibraryPanel(panel: VizPanel) {
    if (!panel.parent) {
      return;
    }

    const parent = panel.parent;

    if (parent instanceof DashboardGridItem) {
      parent.state.body.setState({ $behaviors: undefined });
      return;
    }

    if (parent instanceof AutoGridItem) {
      parent.state.body.setState({ $behaviors: undefined });
      parent.handleEditChange();
      return;
    }

    console.error('Trying to unlink a lib panel in a layout that is not DashboardGridItem or AutoGridItem');
  }

  public showModal(modal: SceneObject) {
    this.setState({ overlay: modal });
  }

  public closeModal() {
    this.setState({ overlay: undefined });
  }

  public onOpenSettings = () => {
    locationService.partial({ editview: 'settings' });
  };

  public onShowAddLibraryPanelDrawer(panelToReplaceRef?: SceneObjectRef<VizPanel>) {
    this.setState({
      overlay: new AddLibraryPanelDrawer({ panelToReplaceRef }),
    });
  }

  public onShowPulseDrawer(panelId?: number) {
    this.setState({
      overlay: new PulseDrawer({ panelId }),
    });
  }

  public onCreateNewRow() {
    return addNewRowTo(this.state.body);
  }

  public onCreateNewPanel(): VizPanel {
    const profiler = getDashboardSceneProfiler();
    const vizPanel = getDefaultVizPanel();
    profiler.attachProfilerToPanel(vizPanel);

    this.addPanel(vizPanel);
    return vizPanel;
  }

  public switchLayout(layout: DashboardLayoutManager, skipUndo?: boolean) {
    const currentLayout = this.state.body;
    const perform = () => this.setState({ body: layout });
    const undo = () => this.setState({ body: currentLayout });
    if (skipUndo) {
      perform();
    } else {
      dashboardEditActions.edit({
        description: t('dashboard.edit-actions.switch-layout', 'Switch layout'),
        source: this,
        perform,
        undo,
      });
    }
  }

  public getLayout(): DashboardLayoutManager {
    return this.state.body;
  }

  /**
   * Called by the SceneQueryRunner to provide contextual parameters (tracking) props for the request
   */
  public enrichDataRequest(sceneObject: SceneObject): Partial<DataQueryRequest> {
    const dashboard = getDashboardSceneFor(sceneObject);

    let panel = getClosestVizPanel(sceneObject);

    if (dashboard.state.isEditing && dashboard.state.editPanel) {
      panel = dashboard.state.editPanel.state.panelRef.resolve();
    }

    let panelId = 0;

    if (panel && panel.state.key) {
      if (isRepeatCloneOrChildOf(panel)) {
        // We check if any of the panel ancestors are clones because we can't use the original panel ID in this case
        panelId = djb2Hash(panel.getPathId());
      } else {
        // Otherwise, it's the absolute original panel, and we can use the key directly
        // getPanelIdForVizPanel extracts the panel ID from the key so we don't need to do it manually
        panelId = getPanelIdForVizPanel(panel);
      }
    }

    return {
      app: CoreApp.Dashboard,
      dashboardUID: this.state.uid,
      panelId,
      panelName: panel?.state?.title,
      panelPluginId: panel?.state.pluginId,
      dashboardTitle: this.state.title,
    };
  }

  canEditDashboard() {
    const {
      meta: { isSnapshot, isEmbedded, canEdit, canMakeEditable },
    } = this.state;
    return !isSnapshot && !isEmbedded && Boolean(canEdit || canMakeEditable || config.viewersCanEdit);
  }

  public getInitialSaveModel() {
    return this.serializer.initialSaveModel;
  }

  public getSnapshotUrl() {
    return this.serializer.getSnapshotUrl() ?? '';
  }

  /** Hacky temp function until we refactor transformSaveModelToScene a bit */
  setInitialSaveModel(model?: Dashboard, meta?: DashboardMeta, apiVersion?: string): void;
  setInitialSaveModel(
    model?: DashboardV2Spec,
    meta?: DashboardWithAccessInfo<DashboardV2Spec>['metadata'],
    apiVersion?: string
  ): void;
  public setInitialSaveModel(
    saveModel?: Dashboard | DashboardV2Spec,
    meta?: DashboardMeta | DashboardWithAccessInfo<DashboardV2Spec>['metadata'],
    apiVersion?: string
  ): void {
    this.serializer.initializeElementMapping(saveModel);
    this.serializer.initializeDSReferencesMapping(saveModel);
    const sortedModel = sortedDeepCloneWithoutNulls(saveModel);
    this.serializer.initialSaveModel = sortedModel;
    this.serializer.metadata = meta;
    this.serializer.apiVersion = apiVersion;
  }

  public getTrackingInformation() {
    return this.serializer.getTrackingInformation(this);
  }

  public getDynamicDashboardsTrackingInformation() {
    return this.serializer.getDynamicDashboardsTrackingInformation(this);
  }

  public async onDashboardDelete() {
    // Need to mark it non dirty to navigate away without unsaved changes warning
    this.setState({ isDirty: false });
    locationService.replace('/');
  }

  public getDashboardPanels() {
    return dashboardSceneGraph.getVizPanels(this);
  }

  public getTransformationCounts(saveModel?: Dashboard | DashboardV2Spec): Record<string, number> | undefined {
    const model = saveModel ?? this.getSaveModel();

    const transformationCounts = new Map<string, number>();

    // Handle V1 dashboards
    if ('panels' in model && model.panels) {
      for (const panel of model.panels) {
        // Count transformations
        if ('transformations' in panel && Array.isArray(panel.transformations)) {
          for (const transformation of panel.transformations) {
            const transformId = transformation?.id;
            if (typeof transformId === 'string' && transformId) {
              transformationCounts.set(transformId, (transformationCounts.get(transformId) || 0) + 1);
            }
          }
        }
      }
    }

    // Handle V2 dashboards
    if ('elements' in model && model.elements) {
      for (const element of Object.values(model.elements)) {
        // Check if element is a Panel (not LibraryPanel)
        if (element.kind !== 'Panel') {
          continue;
        }

        const dataSpec = element.spec.data?.spec;
        if (!dataSpec || typeof dataSpec !== 'object') {
          continue;
        }

        // Count transformations
        const transformations = dataSpec.transformations;
        if (Array.isArray(transformations)) {
          for (const transformation of transformations) {
            const normalized = normalizeTransformation(transformation);
            transformationCounts.set(normalized.group, (transformationCounts.get(normalized.group) || 0) + 1);
          }
        }
      }
    }

    if (transformationCounts.size === 0) {
      return undefined;
    }

    // Convert map to object
    return Object.fromEntries(transformationCounts);
  }

  public getExpressionCounts(saveModel?: Dashboard | DashboardV2Spec): Record<string, number> | undefined {
    const model = saveModel ?? this.getSaveModel();

    const expressionCounts = new Map<string, number>();

    // Handle V1 dashboards
    if ('panels' in model && model.panels) {
      for (const panel of model.panels) {
        // Count expressions from targets
        if ('targets' in panel && panel.targets?.length) {
          for (const target of panel.targets) {
            // Only count if it's actually an expression query
            const datasourceUid =
              target?.datasource && typeof target.datasource === 'object' && 'uid' in target.datasource
                ? target.datasource.uid
                : undefined;

            const targetType = target?.type;
            if (datasourceUid === '__expr__' && typeof targetType === 'string' && targetType) {
              expressionCounts.set(targetType, (expressionCounts.get(targetType) || 0) + 1);
            }
          }
        }
      }
    }

    // Handle V2 dashboards
    if ('elements' in model && model.elements) {
      for (const element of Object.values(model.elements)) {
        // Check if element is a Panel (not LibraryPanel)
        if (element.kind !== 'Panel') {
          continue;
        }

        const dataSpec = element.spec.data?.spec;
        if (!dataSpec || typeof dataSpec !== 'object') {
          continue;
        }

        // Count expressions from queries
        const queries = dataSpec.queries;
        if (Array.isArray(queries)) {
          for (const query of queries) {
            const querySpec = query?.spec?.query;
            if (!querySpec || typeof querySpec !== 'object') {
              continue;
            }

            const datasource = querySpec.datasource;
            const datasourceName =
              datasource && typeof datasource === 'object' && 'name' in datasource ? datasource.name : undefined;

            const spec = querySpec.spec;
            const queryType = spec && typeof spec === 'object' && 'type' in spec ? spec.type : undefined;

            if (datasourceName === '__expr__' && typeof queryType === 'string' && queryType) {
              expressionCounts.set(queryType, (expressionCounts.get(queryType) || 0) + 1);
            }
          }
        }
      }
    }

    if (expressionCounts.size === 0) {
      return undefined;
    }

    // Convert map to object
    return Object.fromEntries(expressionCounts);
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
    return this.serializer.getSaveModel(this);
  }

  // Helper method to build K8s resource structure
  private buildResourceForCreate(spec: Dashboard | DashboardV2Spec, isNew: boolean): ResourceForCreate<unknown> {
    const { meta } = this.state;
    const apiVersion =
      this.serializer instanceof V2DashboardSerializer
        ? dashboardAPIVersionResolver.getV2()
        : dashboardAPIVersionResolver.getV1();
    return {
      apiVersion: `dashboard.grafana.app/${apiVersion}`,
      kind: 'Dashboard',
      metadata: {
        ...meta.k8s,
        name: isNew ? undefined : (meta.uid ?? meta.k8s?.name),
        generateName: isNew ? 'd' : undefined,
      },
      spec,
    };
  }

  // Get the dashboard in native K8s form (using the appropriate apiVersion)
  getSaveResource(options: SaveDashboardAsOptions): ResourceForCreate<unknown> {
    const spec = this.getSaveAsModel(options);
    return this.buildResourceForCreate(spec, options.isNew ?? false);
  }

  // Wrap a raw dashboard spec in K8s resource format
  // Used by JSON model editor for Git sync dashboards
  getSaveResourceFromSpec(rawSpec: Dashboard | DashboardV2Spec): ResourceForCreate<unknown> {
    return this.buildResourceForCreate(rawSpec, false);
  }

  // Get raw JSON from JSON model editor if currently active
  // Returns undefined if not in JSON editor mode or if JSON is invalid
  getRawJsonFromEditor(): Dashboard | DashboardV2Spec | undefined {
    if (this.state.editview instanceof JsonModelEditView) {
      try {
        return JSON.parse(this.state.editview.state.jsonText);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  getSaveAsModel(options: SaveDashboardAsOptions): Dashboard | DashboardV2Spec {
    return this.serializer.getSaveAsModel(this, options);
  }

  getDashboardChanges(saveTimeRange?: boolean, saveVariables?: boolean, saveRefresh?: boolean): DashboardChangeInfo {
    const rawJson = this.getRawJsonFromEditor();
    return this.serializer.getDashboardChangesFromScene(this, { saveTimeRange, saveVariables, saveRefresh, rawJson });
  }

  getManagerKind(): ManagerKind | undefined {
    return this.state.meta.k8s?.annotations?.[AnnoKeyManagerKind];
  }

  getManagerIdentity(): string | undefined {
    // get repo name if any
    return this.state.meta.k8s?.annotations?.[AnnoKeyManagerIdentity];
  }

  isManaged() {
    return Boolean(this.getManagerKind());
  }

  isManagedRepository() {
    if (!config.featureToggles.provisioning) {
      return false;
    }
    return Boolean(this.getManagerKind() === ManagerKind.Repo);
  }

  managedResourceCannotBeEdited() {
    return (
      this.isManaged() && !this.isManagedRepository() && !this.state.meta.k8s?.annotations?.[AnnoKeyManagerAllowsEdits]
    );
  }

  getPath() {
    return this.state.meta.k8s?.annotations?.[AnnoKeySourcePath];
  }

  private hasVariableErrors(): boolean {
    return Boolean(this.state.$variables?.state.variables.find((v) => Boolean(v.state.error)));
  }

  /**
   * Default layout used for new Tab and Row containers
   * Undefined if default layout is not set in preferences
   */
  getDefaultLayout() {
    if (this.state.preferences?.defaultLayoutTemplate) {
      return this.state.preferences.defaultLayoutTemplate.clone();
    }
    return undefined;
  }

  getDefaultLayoutType() {
    return this.state.preferences?.defaultLayoutTemplate?.descriptor?.id;
  }

  updateDefaultLayoutTemplate(template: DashboardLayoutManager) {
    this.setState({
      preferences: {
        ...this.state.preferences,
        defaultLayoutTemplate: template.clone(),
      },
    });
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
  }
}
