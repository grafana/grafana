import * as H from 'history';
import { debounce } from 'lodash';

import { NavIndex, PanelPlugin } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import {
  PanelBuilders,
  SceneDataTransformer,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneObjectStateChangedEvent,
  SceneQueryRunner,
  sceneUtils,
  VizPanel,
} from '@grafana/scenes';
import { Panel } from '@grafana/schema/dist/esm/index.gen';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getLastUsedDatasourceFromStorage } from 'app/features/dashboard/utils/dashboard';
import { saveLibPanel } from 'app/features/library-panels/state/api';

import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';
import { getPanelChanges } from '../saving/getDashboardChanges';
import { DashboardLayoutItem, isDashboardLayoutItem } from '../scene/types/DashboardLayoutItem';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import {
  activateSceneObjectAndParentTree,
  getDashboardSceneFor,
  getLibraryPanelBehavior,
  getPanelIdForVizPanel,
} from '../utils/utils';

import { DataProviderSharer } from './PanelDataPane/DataProviderSharer';
import { PanelDataPane } from './PanelDataPane/PanelDataPane';
import { PanelEditorRenderer } from './PanelEditorRenderer';
import { PanelOptionsPane } from './PanelOptionsPane';

export interface PanelEditorState extends SceneObjectState {
  isNewPanel: boolean;
  isDirty?: boolean;
  optionsPane?: PanelOptionsPane;
  dataPane?: PanelDataPane;
  panelRef: SceneObjectRef<VizPanel>;
  showLibraryPanelSaveModal?: boolean;
  showLibraryPanelUnlinkModal?: boolean;
  tableView?: VizPanel;
  pluginLoadErrror?: string;
  /**
   * Waiting for library panel or panel plugin to load
   */
  isInitializing?: boolean;
}

export class PanelEditor extends SceneObjectBase<PanelEditorState> {
  static Component = PanelEditorRenderer;

  private _layoutItemState?: SceneObjectState;
  private _layoutItem: DashboardLayoutItem;
  private _originalSaveModel!: Panel;
  private _changesHaveBeenMade = false;

  public constructor(state: PanelEditorState) {
    super(state);

    const panel = this.state.panelRef.resolve();
    const layoutItem = panel.parent;
    if (!layoutItem || !isDashboardLayoutItem(layoutItem)) {
      throw new Error('Panel must have a parent of type DashboardLayoutItem');
    }

    this._layoutItem = layoutItem;

    this.setOriginalState(this.state.panelRef);
    this.addActivationHandler(this._activationHandler.bind(this));
  }

  private _activationHandler() {
    const panel = this.state.panelRef.resolve();
    const deactivateParents = activateSceneObjectAndParentTree(panel);

    this.waitForPlugin();

    return () => {
      this._layoutItem.editingCompleted?.(this.state.isDirty || this._changesHaveBeenMade);

      if (deactivateParents) {
        deactivateParents();
      }
    };
  }
  private waitForPlugin(retry = 0) {
    const panel = this.getPanel();
    const plugin = panel.getPlugin();

    if (!plugin || plugin.meta.id !== panel.state.pluginId) {
      if (retry < 100) {
        setTimeout(() => this.waitForPlugin(retry + 1), retry * 10);
      } else {
        this.setState({ pluginLoadErrror: 'Failed to load panel plugin' });
      }
      return;
    }

    this.gotPanelPlugin(plugin);
  }

  private setOriginalState(panelRef: SceneObjectRef<VizPanel>) {
    const panel = panelRef.resolve();

    this._originalSaveModel = vizPanelToPanel(panel);
    this._layoutItemState = sceneUtils.cloneSceneObjectState(this._layoutItem.state);
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
      const { hasChanges } = getPanelChanges(this._originalSaveModel, vizPanelToPanel(panel));
      this.setState({ isDirty: hasChanges });
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

      this._layoutItem.editingStarted?.();

      this._setupChangeDetection();
      this._updateDataPane(plugin);

      // Listen for panel plugin changes
      this._subs.add(
        panel.subscribeToState((n, p) => {
          if (n.pluginId !== p.pluginId) {
            this.waitForPlugin();
          }
        })
      );

      // Setup options pane
      this.setState({
        optionsPane: new PanelOptionsPane({
          panelRef: this.state.panelRef,
          searchQuery: '',
          listMode: OptionFilter.All,
        }),
        isInitializing: false,
      });
    } else {
      // plugin changed after first time initialization
      // Just update data pane
      this._updateDataPane(plugin);
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

      // clean up data provider when switching from data to non data panel
      if (panel.state.$data) {
        panel.setState({
          $data: undefined,
        });
      }
    }

    if (!skipDataQuery) {
      if (!this.state.dataPane) {
        this.setState({ dataPane: PanelDataPane.createFor(this.getPanel()) });
      }

      // add data provider when switching from non data to data panel
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
              queries: [{ refId: 'A' }],
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
      text: 'Edit panel',
      parentItem: dashboard.getPageNav(location, navIndex),
    };
  }

  public onDiscard = () => {
    this.setState({ isDirty: false });

    const panel = this.state.panelRef.resolve();

    if (this.state.isNewPanel) {
      getDashboardSceneFor(this).removePanel(panel);
    } else {
      // Revert any layout element changes
      this._layoutItem!.setState(this._layoutItemState!);
    }

    locationService.partial({ editPanel: null });
  };

  public dashboardSaved() {
    this.setOriginalState(this.state.panelRef);
    this.setState({ isDirty: false });

    // Remember that we have done changes
    this._changesHaveBeenMade = true;
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
}

export function buildPanelEditScene(panel: VizPanel, isNewPanel = false): PanelEditor {
  return new PanelEditor({
    isInitializing: true,
    panelRef: panel.getRef(),
    isNewPanel,
  });
}
