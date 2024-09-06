import * as H from 'history';

import { NavIndex } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';

import { DashboardGridItem } from '../scene/DashboardGridItem';
import { activateInActiveParents, getDashboardSceneFor, getPanelIdForVizPanel } from '../utils/utils';

import { PanelDataPane } from './PanelDataPane/PanelDataPane';
import { PanelEditorRenderer } from './PanelEditorRenderer';
import { PanelOptionsPane } from './PanelOptionsPane';

export interface PanelEditorState extends SceneObjectState {
  isNewPanel: boolean;
  isDirty?: boolean;
  panelId: number;
  optionsPane: PanelOptionsPane;
  dataPane?: PanelDataPane;
  panelRef: SceneObjectRef<VizPanel>;
  pluginId: string;
  showLibraryPanelSaveModal?: boolean;
  showLibraryPanelUnlinkModal?: boolean;
  tableView?: boolean;
  pluginLoadError?: boolean;
}

export class PanelEditor extends SceneObjectBase<PanelEditorState> {
  static Component = PanelEditorRenderer;

  public constructor(state: PanelEditorState) {
    super(state);
    this.addActivationHandler(this._activationHandler.bind(this));
  }

  private _activationHandler() {
    const panel = this.state.panelRef.resolve();
    activateInActiveParents(panel);

    this._initDataPane();

    // this._subs.add(
    //   panelManager.subscribeToState((n, p) => {
    //     if (n.pluginId !== p.pluginId) {
    //       this._initDataPane(n.pluginId);
    //     }
    //   })
    // );

    // return () => {
    //   if (!this._discardChanges) {
    //     this.commitChanges();
    //   } else if (this.state.isNewPanel) {
    //     getDashboardSceneFor(this).removePanel(panelManager.state.sourcePanel.resolve()!);
    //   }
    // };
  }

  public getPanel(): VizPanel {
    return this.state.panelRef?.resolve();
  }

  private _initDataPane(retry = 0) {
    const panel = this.getPanel();
    const plugin = panel.getPlugin();

    if (!plugin) {
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
    return this.state.panelId.toString();
  }

  public getPageNav(location: H.Location, navIndex: NavIndex) {
    const dashboard = getDashboardSceneFor(this);

    return {
      text: 'Edit panel',
      parentItem: dashboard.getPageNav(location, navIndex),
    };
  }

  public onDiscard = () => {
    // this.state.vizManager.setState({ isDirty: false });
    // this._discardChanges = true;
    locationService.partial({ editPanel: null });
  };

  public commitChanges() {
    // const dashboard = getDashboardSceneFor(this);
    // if (!dashboard.state.isEditing) {
    //   dashboard.onEnterEditMode();
    // }
    // const panelManager = this.state.vizManager;
    // const sourcePanel = panelManager.state.sourcePanel.resolve();
    // const gridItem = sourcePanel!.parent;
    // if (!(gridItem instanceof DashboardGridItem)) {
    //   console.error('Unsupported scene object type');
    //   return;
    // }
    // this.commitChangesToSource(gridItem);
  }

  private commitChangesToSource(gridItem: DashboardGridItem) {
    // let width = gridItem.state.width ?? 1;
    // let height = gridItem.state.height;
    // const panelManager = this.state.vizManager;
    // const horizontalToVertical =
    //   this._initialRepeatOptions.repeatDirection === 'h' && panelManager.state.repeatDirection === 'v';
    // const verticalToHorizontal =
    //   this._initialRepeatOptions.repeatDirection === 'v' && panelManager.state.repeatDirection === 'h';
    // if (horizontalToVertical) {
    //   width = Math.floor(width / (gridItem.state.maxPerRow ?? 1));
    // } else if (verticalToHorizontal) {
    //   width = 24;
    // }
    // gridItem.setState({
    //   body: panelManager.state.panel.clone(),
    //   repeatDirection: panelManager.state.repeatDirection,
    //   variableName: panelManager.state.repeat,
    //   maxPerRow: panelManager.state.maxPerRow,
    //   width,
    //   height,
    // });
  }

  public onSaveLibraryPanel = () => {
    this.setState({ showLibraryPanelSaveModal: true });
  };

  public onConfirmSaveLibraryPanel = () => {
    // this.state.vizManager.commitChanges();
    // this.state.vizManager.setState({ isDirty: false });
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
    this.setState({ tableView: !this.state.tableView });
  };
}

export function buildPanelEditScene(panel: VizPanel, isNewPanel = false): PanelEditor {
  return new PanelEditor({
    panelId: getPanelIdForVizPanel(panel),
    optionsPane: new PanelOptionsPane({
      panelRef: panel.getRef(),
      searchQuery: '',
      listMode: OptionFilter.All,
    }),
    panelRef: panel.getRef(),
    pluginId: panel.state.pluginId,
    isNewPanel,
  });
}
