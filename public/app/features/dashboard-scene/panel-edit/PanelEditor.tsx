import deepEqual from 'fast-deep-equal';
import type * as H from 'history';
import { debounce } from 'lodash';

import { type NavIndex, type PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import {
  NewSceneObjectAddedEvent,
  PanelBuilders,
  type SceneComponentProps,
  SceneDataTransformer,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  SceneObjectStateChangedEvent,
  SceneQueryRunner,
  sceneUtils,
  type VizPanel,
} from '@grafana/scenes';
import { type Panel } from '@grafana/schema';
import { isDashboardNewLayoutsEnabled } from 'app/features/dashboard/api/utils';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getLastUsedDatasourceFromStorage } from 'app/features/dashboard/utils/dashboard';
import { saveLibPanel } from 'app/features/library-panels/state/api';
import { vizSuggestionsTracker } from 'app/features/panel/components/VizTypePicker/interactions';
import { createDefaultQuery } from 'app/features/query/state/queryDefaults';

import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';
import { type LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from '../scene/UnconfiguredPanel';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import {
  type AdHocTransformationsByPanelKey,
  collectAdHocTransformations,
  restoreAdHocTransformations,
} from '../scene/panel-actions/adHocTransformations';
import { type DashboardLayoutItem, isDashboardLayoutItem } from '../scene/types/DashboardLayoutItem';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { DashboardEditActionEvent } from '../sidebar/events';
import { SIDEBAR_COLLAPSED_KEY } from '../sidebar/shared';
import { clearDefaultQuery } from '../utils/clearDefaultQuery';
import { findVizPanelByKey } from '../utils/findVizPanel';
import { getEmptyQueryRunnerState } from '../utils/queryRunnerState';
import { getDashboardSceneFor, getLibraryPanelBehavior } from '../utils/utils';
import { getPanelIdForVizPanel } from '../utils/utils-panels';

import { DataProviderSharer } from './PanelDataPane/DataProviderSharer';
import { type PanelDataPane } from './PanelDataPane/PanelDataPane';
import { createPanelDataPane } from './PanelDataPane/PanelDataPaneFactory';
import { type PanelDataPaneNext } from './PanelEditNext/PanelDataPaneNext';
import { PanelEditorRendererNext } from './PanelEditNext/PanelEditorRendererNext';
import { QUERY_EDITOR_V2_PREFERENCE_KEY } from './PanelEditNext/constants';
import { getLocalStorageWithTTL, setLocalStorageWithTTL } from './PanelEditNext/localStorageWithTTL';
import { trackEditorVersionToggle } from './PanelEditNext/tracking';
import { PanelEditorRenderer } from './PanelEditorRenderer';
import { PanelOptionsPane } from './PanelOptionsPane';
import { diffPanelEditSnapshots, type PanelEditSnapshot, takePanelEditSnapshot } from './panelEditChanges';

/**
 * Properties of the panel_edit_closed and panel_edit_discarded interactions.
 * Every value is a low-cardinality literal: never add titles, queries or option values here.
 */
interface PanelEditSummary {
  changed: boolean;
  changed_options: boolean;
  changed_field_config: boolean;
  changed_overrides: boolean;
  changed_queries: boolean;
  changed_transformations: boolean;
  changed_panel_info: boolean;
  changed_repeat: boolean;
  saved_in_editor: boolean;
  panel_type: string;
  panel_id: number;
  is_new_panel: boolean;
  is_library_panel: boolean;
  // Bursts of query edits made in either query editor; see recordQueryEdit.
  query_change_count: number;
  query_editor: 'classic' | 'next';
  // Same key every dashboards_* interaction carries, so these events split by layout the same way.
  isDynamicDashboard: boolean;
}

const QUERY_EDIT_BURST_MS = 2000;

export interface PanelEditorState extends SceneObjectState {
  isNewPanel: boolean;
  isDirty?: boolean;
  optionsPane?: PanelOptionsPane;
  dataPane?: PanelDataPane | PanelDataPaneNext;
  panelRef: SceneObjectRef<VizPanel>;
  showLibraryPanelSaveModal?: boolean;
  showLibraryPanelUnlinkModal?: boolean;
  tableView?: VizPanel;
  pluginLoadError?: string;
  /**
   * Waiting for library panel or panel plugin to load
   */
  isInitializing?: boolean;
  /**
   * Enable the v2 query editor experience
   */
  useQueryExperienceNext?: boolean;
}

export class PanelEditor extends SceneObjectBase<PanelEditorState> {
  static Component = ({ model }: SceneComponentProps<PanelEditor>) => {
    const { useQueryExperienceNext } = model.useState();
    return useQueryExperienceNext ? <PanelEditorRendererNext model={model} /> : <PanelEditorRenderer model={model} />;
  };

  private _layoutItemState?: SceneObjectState;
  private _layoutItemAdHocTransformations?: AdHocTransformationsByPanelKey;
  private _layoutItem: DashboardLayoutItem;
  private _originalSaveModel!: Panel;
  private _changesHaveBeenMade = false;
  // Analytics only: the baseline excludes what the editor itself sets up (default query, plugin defaults),
  // unlike _originalSaveModel, so it can tell which areas the user changed.
  private _changeBaseline!: PanelEditSnapshot;
  private _savedInEditor = false;
  private _discardSummary?: PanelEditSummary;
  private _queryChangeCount = 0;
  private _lastQueryEditAt = -Infinity;

  public constructor(state: PanelEditorState) {
    super(state);

    const panel = this.state.panelRef.resolve();
    const layoutItem = panel.parent;
    if (!layoutItem || !isDashboardLayoutItem(layoutItem)) {
      throw new Error('Panel must have a parent of type DashboardLayoutItem');
    }

    this._layoutItem = layoutItem;

    this.setOriginalState(this.state.panelRef);
    this.resetChangeBaseline();
    this.addActivationHandler(this._activationHandler.bind(this));
  }

  private _activationHandler() {
    const panel = this.state.panelRef.resolve();
    const dashboard = getDashboardSceneFor(this);

    // Clear any panel selection when entering panel edit mode.
    // Need to clear selection here since selection is activated when panel edit mode is entered through the panel actions menu. This causes sidebar panel editor to be open when exiting panel edit mode
    dashboard.state.sidebar.clearSelection();

    if (panel.state.pluginId === UNCONFIGURED_PANEL_PLUGIN_ID) {
      const isPaneCollapsed = sessionStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
      if (isPaneCollapsed) {
        panel.changePluginType('timeseries');
      }
    }

    // Each activation is a separate visit for the close event.
    this._discardSummary = undefined;
    this._savedInEditor = false;
    this._queryChangeCount = 0;
    this._lastQueryEditAt = -Infinity;
    this.resetChangeBaseline();

    // Splitter layout and table view changes remount the preview; keep its event subscriptions alive.
    this._subs.add(this._layoutItem.activate());
    this._subs.add(panel.activate());

    // An already-active provider may be owned by panel notices rather than the panel.
    let deactivateData = panel.state.$data?.activate();
    this._subs.add(() => deactivateData?.());

    this._subs.add(
      this._layoutItem.subscribeToEvent(DashboardEditActionEvent, ({ payload }) => {
        // TODO add support for undo/redo within panel edit
        payload.perform();
      })
    );

    // Listen for panel plugin changes
    this._subs.add(
      panel.subscribeToState((n, p) => {
        if (n.$data !== p.$data) {
          deactivateData?.();
          deactivateData = n.$data?.activate();
        }
        if (n.pluginId !== p.pluginId) {
          this.waitForPlugin();
        }
      })
    );

    if (!this.state.isInitializing) {
      this._setupChangeDetection();
    }

    this.waitForPlugin();

    return () => {
      this.commitChanges();
      reportInteraction('panel_edit_closed', {
        ...(this._discardSummary ?? this.getEditSummary()),
        outcome: this._discardSummary ? 'discarded' : 'kept',
      });
    };
  }

  private resetChangeBaseline() {
    this._changeBaseline = takePanelEditSnapshot(this.state.panelRef.resolve(), this._layoutItem);
  }

  private getEditSummary(): PanelEditSummary {
    const panel = this.getPanel();
    // Compared with when the visit started, so changes saved from inside the editor still count.
    const areas = diffPanelEditSnapshots(this._changeBaseline, takePanelEditSnapshot(panel, this._layoutItem));

    return {
      changed: Object.values(areas).some(Boolean),
      changed_options: areas.options,
      changed_field_config: areas.field_config,
      changed_overrides: areas.overrides,
      changed_queries: areas.queries,
      changed_transformations: areas.transformations,
      changed_panel_info: areas.panel_info,
      changed_repeat: areas.repeat,
      saved_in_editor: this._savedInEditor,
      panel_type: panel.state.pluginId,
      panel_id: getPanelIdForVizPanel(panel),
      is_new_panel: this.state.isNewPanel,
      is_library_panel: getLibraryPanelBehavior(panel) !== undefined,
      query_change_count: this._queryChangeCount,
      query_editor: this.state.useQueryExperienceNext ? 'next' : 'classic',
      isDynamicDashboard: isDashboardNewLayoutsEnabled(),
    };
  }

  private commitChanges() {
    if (!this.state.isDirty && !this._changesHaveBeenMade) {
      // Nothing to commit
      return;
    }

    const panel = this.state.panelRef.resolve();
    if (findVizPanelByKey(getDashboardSceneFor(this), panel.state.key) !== panel) {
      // Our tree was replaced wholesale (APPLY_SPEC and the json/code editors rebuild the scene),
      // so there is nothing to commit onto: the edit action below would be sourced from a layout
      // item that never activates again, and the sidebar retries an inactive source forever.
      return;
    }

    const layoutItem = this._layoutItem;
    const changedState = layoutItem.state;
    const changedAdHocTransformations = collectAdHocTransformations(layoutItem);
    const originalState = this._layoutItemState!;
    const originalAdHocTransformations = this._layoutItemAdHocTransformations;

    // Temp fix for old edit mode
    if (this._layoutItem instanceof DashboardGridItem && !isDashboardNewLayoutsEnabled()) {
      this._layoutItem.handleEditChange();
      return;
    }

    const editAction = new DashboardEditActionEvent({
      meta: { actionId: 'panel.edit' },
      description: t('dashboard.edit-actions.panel-edit', 'Panel changes'),
      source: this._layoutItem,
      perform: () => {
        // Because panel edit makes changes directly to layout item & panel
        // we only need to do this in case we want to re-perform after undo
        if (layoutItem.state !== changedState) {
          setLayoutItemState(layoutItem, changedState, changedAdHocTransformations);
        }
      },
      undo: () => setLayoutItemState(layoutItem, originalState, originalAdHocTransformations),
    });

    // sadly we cannot publish this event directly here as the main dashboard edit / undo system
    // is not active while panel edit is active so we have to let the sidebar (which owns undo/redo)
    // publish this event when it activates
    const dashboard = getDashboardSceneFor(this);
    if (this.state.isDirty) {
      dashboard.recordEditMutation();
    }
    dashboard.state.sidebar.setPanelEditAction(editAction);
  }

  public waitForPlugin(retry = 0) {
    const panel = this.getPanel();
    const plugin = panel.getPlugin();

    if (!plugin || plugin.meta.id !== panel.state.pluginId) {
      if (retry < 100) {
        setTimeout(() => this.waitForPlugin(retry + 1), retry * 10);
      } else {
        this.setState({ pluginLoadError: 'Failed to load panel plugin' });
      }
      return;
    }

    this.gotPanelPlugin(plugin);
  }

  private setOriginalState(panelRef: SceneObjectRef<VizPanel>) {
    const panel = panelRef.resolve();

    this._originalSaveModel = vizPanelToPanel(panel);
    this._layoutItemState = sceneUtils.cloneSceneObjectState(this._layoutItem.state);
    this._layoutItemAdHocTransformations = collectAdHocTransformations(this._layoutItem);
  }

  /**
   * Useful for testing to turn on debounce
   */
  public debounceSaveModelDiff = true;

  /**
   * Subscribe to state changes and check if the save model has changed
   */
  private _setupChangeDetection() {
    const panel = this.state.panelRef.resolve();
    const performSaveModelDiff = () => {
      this.setState({ isDirty: !deepEqual(this._originalSaveModel, vizPanelToPanel(panel)) });
    };

    const performSaveModelDiffDebounced = this.debounceSaveModelDiff
      ? debounce(performSaveModelDiff, 250)
      : performSaveModelDiff;

    const handleStateChange = (event: SceneObjectStateChangedEvent) => {
      if (DashboardSceneChangeTracker.isUpdatingPersistedState(event)) {
        performSaveModelDiffDebounced();
      }
    };

    // Subscribe to state changes on the parent (layout item) so we do not miss state changes on the layout item
    this._subs.add(this._layoutItem.subscribeToEvent(SceneObjectStateChangedEvent, handleStateChange));
  }

  public getPanel(): VizPanel {
    return this.state.panelRef?.resolve();
  }

  private gotPanelPlugin(plugin: PanelPlugin) {
    const panel = this.getPanel();

    // First time initialization
    if (this.state.isInitializing) {
      this.setOriginalState(this.state.panelRef);
      this._setupChangeDetection();
      this._updateDataPane(plugin);
      this.resetChangeBaseline();

      // Setup options pane
      const optionsPane = new PanelOptionsPane({
        panelRef: this.state.panelRef,
        searchQuery: '',
        listMode: OptionFilter.All,
        isVizPickerOpen: panel.state.pluginId === UNCONFIGURED_PANEL_PLUGIN_ID,
        isNewPanel: this.state.isNewPanel,
      });

      this.setState({ optionsPane, isInitializing: false });
    } else {
      // plugin changed after first time initialization
      // Just update data pane
      this._updateDataPane(plugin);
    }

    // If switching plugin when tableView is enabled, then disable it
    if (this.state.tableView) {
      this.setState({ tableView: undefined });
    }
  }

  private _updateDataPane(plugin: PanelPlugin) {
    const skipDataQuery = plugin.meta.skipDataQuery;

    const panel = this.state.panelRef.resolve();

    if (skipDataQuery) {
      if (this.state.dataPane) {
        locationService.partial({ tab: null }, true);
        this.setState({ dataPane: undefined });
      }

      if (panel.state.$data) {
        panel.setState({ $data: undefined });
      }
    }

    if (!skipDataQuery) {
      if (plugin.meta.skipDefaultQuery && this.state.isNewPanel && this.state.isInitializing) {
        clearDefaultQuery(panel);
      }

      if (!this.state.dataPane) {
        const dataPane = createPanelDataPane(this.getPanel(), this.state.useQueryExperienceNext);
        this.setState({ dataPane });
        this.publishEvent(new NewSceneObjectAddedEvent(dataPane), true);
      }

      if (!panel.state.$data) {
        let ds = getLastUsedDatasourceFromStorage(getDashboardSceneFor(this).state.uid!)?.datasourceUid;
        if (!ds) {
          ds = config.defaultDatasource;
        }

        panel.setState({
          $data: new SceneDataTransformer({
            $data: new SceneQueryRunner({
              datasource: {
                uid: ds,
              },
              ...(plugin.meta.skipDefaultQuery ? getEmptyQueryRunnerState() : { queries: [createDefaultQuery()] }),
            }),
            transformations: [],
          }),
        });
      }
    }
  }

  public getUrlKey() {
    return this.getPanelId().toString();
  }

  public getPanelId() {
    return getPanelIdForVizPanel(this.state.panelRef.resolve());
  }

  public getPageNav(location: H.Location, navIndex: NavIndex) {
    const dashboard = getDashboardSceneFor(this);

    return {
      text: t('dashboard-scene.panel-editor.text.edit-panel', 'Edit panel'),
      parentItem: dashboard.getPageNav(location, navIndex),
    };
  }

  public onDiscard = () => {
    // Summarize before reverting, while the discarded changes are still on the panel.
    this._discardSummary = this.getEditSummary();
    reportInteraction('panel_edit_discarded', { ...this._discardSummary });
    this.setState({ isDirty: false });

    const panel = this.state.panelRef.resolve();
    const dashboard = getDashboardSceneFor(this);

    // clear pending suggestions
    vizSuggestionsTracker.record(panel.state.key!, undefined);

    if (this.state.isNewPanel) {
      dashboard.removePanel(panel);
    } else {
      // Revert any layout element changes
      setLayoutItemState(this._layoutItem, this._layoutItemState!, this._layoutItemAdHocTransformations);
    }

    locationService.partial({ editPanel: null });
  };

  /**
   * Called when a query editor changes a query. Editors report every keystroke, so edits less than
   * QUERY_EDIT_BURST_MS apart count once: the count says how often someone went back to a query.
   */
  public recordQueryEdit(now = Date.now()) {
    if (now - this._lastQueryEditAt > QUERY_EDIT_BURST_MS) {
      this._queryChangeCount++;
    }
    this._lastQueryEditAt = now;
  }

  public dashboardSaved() {
    this._savedInEditor = true;
    this.setOriginalState(this.state.panelRef);
    this.setState({ isDirty: false });

    // Remember that we have done changes
    this._changesHaveBeenMade = true;
  }

  public getLibraryPanelBehavior(): LibraryPanelBehavior | undefined {
    return getLibraryPanelBehavior(this.getPanel());
  }

  public onSaveLibraryPanel = () => {
    this.setState({ showLibraryPanelSaveModal: true });
  };

  public onConfirmSaveLibraryPanel = () => {
    saveLibPanel(this.state.panelRef.resolve());
    this.setState({ isDirty: false });
    locationService.partial({ editPanel: null });
  };

  public onDismissLibraryPanelSaveModal = () => {
    this.setState({ showLibraryPanelSaveModal: false });
  };

  public onUnlinkLibraryPanel = () => {
    this.setState({ showLibraryPanelUnlinkModal: true });
  };

  public onDismissUnlinkLibraryPanelModal = () => {
    this.setState({ showLibraryPanelUnlinkModal: false });
  };

  public onConfirmUnlinkLibraryPanel = () => {
    const libPanelBehavior = getLibraryPanelBehavior(this.getPanel());
    if (!libPanelBehavior) {
      return;
    }

    libPanelBehavior.unlink();

    this.setState({ showLibraryPanelUnlinkModal: false });
  };

  public onToggleTableView = () => {
    if (this.state.tableView) {
      this.setState({ tableView: undefined });
      return;
    }

    const panel = this.state.panelRef.resolve();
    const dataProvider = panel.state.$data;
    if (!dataProvider) {
      return;
    }

    this.setState({
      tableView: PanelBuilders.table()
        .setTitle('')
        .setOption('showTypeIcons', true)
        .setOption('showHeader', true)
        .setData(new DataProviderSharer({ source: dataProvider.getRef() }))
        .build(),
    });
  };

  /**
   * Toggle between v1 and v2 query editor.
   */
  public onToggleQueryEditorVersion = () => {
    const newUseQueryExperienceNext = !this.state.useQueryExperienceNext;
    trackEditorVersionToggle(newUseQueryExperienceNext ? 'upgrade' : 'downgrade');
    const dataPane = createPanelDataPane(this.getPanel(), newUseQueryExperienceNext);

    setLocalStorageWithTTL(QUERY_EDITOR_V2_PREFERENCE_KEY, newUseQueryExperienceNext);

    this.setState({
      useQueryExperienceNext: newUseQueryExperienceNext,
      dataPane,
    });

    // This is to notify UrlSyncManager that a new object has been added to scene that requires url sync
    this.publishEvent(new NewSceneObjectAddedEvent(dataPane), true);
  };
}

function setLayoutItemState(
  layoutItem: DashboardLayoutItem,
  state: SceneObjectState,
  baseline?: AdHocTransformationsByPanelKey
) {
  const adHocTransformations = collectAdHocTransformations(layoutItem);
  layoutItem.setState(state);
  restoreAdHocTransformations(layoutItem, adHocTransformations, baseline);
}

export function buildPanelEditScene(panel: VizPanel, isNewPanel = false): PanelEditor {
  const isQueryEditorNextEnabled = getFeatureFlagClient().getBooleanValue(FlagKeys.QueryEditorNext, false);
  const storedPreference = isQueryEditorNextEnabled
    ? getLocalStorageWithTTL<boolean>(QUERY_EDITOR_V2_PREFERENCE_KEY)
    : null;
  const useQueryExperienceNext = storedPreference ?? isQueryEditorNextEnabled;

  return new PanelEditor({
    useQueryExperienceNext,
    isInitializing: true,
    panelRef: panel.getRef(),
    isNewPanel,
  });
}
