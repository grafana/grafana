import * as H from 'history';
import { debounce } from 'lodash';

import { NavIndex } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  PanelBuilders,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneObjectStateChangedEvent,
  VizPanel,
  VizPanelState,
} from '@grafana/scenes';
import { Panel } from '@grafana/schema/dist/esm/index.gen';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { saveLibPanel } from 'app/features/library-panels/state/api';

import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';
import { getPanelChanges } from '../saving/getDashboardChanges';
import { DashboardGridItem, DashboardGridItemState } from '../scene/DashboardGridItem';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { activateInActiveParents, getDashboardSceneFor, getPanelIdForVizPanel } from '../utils/utils';

import { DataProviderSharer } from './PanelDataPane/DataProviderSharer';
import { PanelDataPane } from './PanelDataPane/PanelDataPane';
import { PanelEditorRenderer } from './PanelEditorRenderer';
import { PanelOptionsPane } from './PanelOptionsPane';

export interface PanelEditorState extends SceneObjectState {
  isNewPanel: boolean;
  isDirty?: boolean;
  optionsPane: PanelOptionsPane;
  dataPane?: PanelDataPane;
  panelRef: SceneObjectRef<VizPanel>;
  showLibraryPanelSaveModal?: boolean;
  showLibraryPanelUnlinkModal?: boolean;
  tableView?: VizPanel;
  pluginLoadError?: boolean;
}

export class PanelEditor extends SceneObjectBase<PanelEditorState> {
  static Component = PanelEditorRenderer;

  private _originalState!: VizPanelState;
  private _originalLayoutElementState!: DashboardGridItemState;
  private _layoutElement!: DashboardGridItem;
  private _originalSaveModel!: Panel;

  public constructor(state: PanelEditorState) {
    super(state);

    this.setOriginalState(state.panelRef);
    this.addActivationHandler(this._activationHandler.bind(this));
  }

  private setOriginalState(panelRef: SceneObjectRef<VizPanel>) {
    const panel = panelRef.resolve();

    this._originalState = panel.state;
    this._originalSaveModel = vizPanelToPanel(panel);

    if (panel.parent instanceof DashboardGridItem) {
      this._originalLayoutElementState = panel.parent.state;
      this._layoutElement = panel.parent;
    }
  }

  private _activationHandler() {
    const panel = this.state.panelRef.resolve();
    activateInActiveParents(panel);

    this._initDataPane();

    this._subs.add(panel.subscribeToEvent(SceneObjectStateChangedEvent, this._handleStateChange));

    // Repeat options live on the layout element (DashboardGridItem)
    this._subs.add(this._layoutElement.subscribeToEvent(SceneObjectStateChangedEvent, this._handleStateChange));

    // Listen for panel plugin changes
    this._subs.add(
      panel.subscribeToState((n, p) => {
        if (n.pluginId !== p.pluginId) {
          this._initDataPane();
        }
      })
    );
  }

  private _detectPanelModelChanges = debounce(() => {
    const { hasChanges } = getPanelChanges(this._originalSaveModel, vizPanelToPanel(this.state.panelRef.resolve()));
    this.setState({ isDirty: hasChanges });
  }, 250);

  private _handleStateChange = (event: SceneObjectStateChangedEvent) => {
    if (DashboardSceneChangeTracker.isUpdatingPersistedState(event)) {
      this._detectPanelModelChanges();
    }
  };

  public getPanel(): VizPanel {
    return this.state.panelRef?.resolve();
  }

  private _initDataPane(retry = 0) {
    const panel = this.getPanel();
    const plugin = panel.getPlugin();

    if (!plugin || plugin.meta.id !== panel.state.pluginId) {
      if (retry < 100) {
        setTimeout(() => this._initDataPane(retry + 1), 10);
      } else {
        this.setState({ pluginLoadError: true });
      }

      return;
    }

    const skipDataQuery = plugin.meta.skipDataQuery;

    if (skipDataQuery && this.state.dataPane) {
      locationService.partial({ tab: null }, true);
      this.setState({ dataPane: undefined });
    }

    if (!skipDataQuery && !this.state.dataPane) {
      this.setState({ dataPane: PanelDataPane.createFor(panel) });
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

    // Revert VizPanel changes
    panel.setState(this._originalState!);

    // Rrevert any layout element changes
    this._layoutElement.setState(this._originalLayoutElementState!);

    if (this.state.isNewPanel) {
      getDashboardSceneFor(this).removePanel(panel);
    }

    // this._discardChanges = true;
    locationService.partial({ editPanel: null });
  };

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
    //this.state.vizManager.unlinkLibraryPanel();
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
    optionsPane: new PanelOptionsPane({
      panelRef: panel.getRef(),
      searchQuery: '',
      listMode: OptionFilter.All,
    }),
    panelRef: panel.getRef(),
    isNewPanel,
  });
}
