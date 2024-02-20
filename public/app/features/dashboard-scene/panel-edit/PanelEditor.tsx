import * as H from 'history';

import { NavIndex } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import {
  SceneGridItem,
  SceneGridLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';

import { PanelRepeaterGridItem } from '../scene/PanelRepeaterGridItem';
import {
  findVizPanelByKey,
  getDashboardSceneFor,
  getPanelIdForVizPanel,
  getVizPanelKeyForPanelId,
} from '../utils/utils';

import { PanelDataPane } from './PanelDataPane/PanelDataPane';
import { PanelEditorRenderer } from './PanelEditorRenderer';
import { PanelOptionsPane } from './PanelOptionsPane';
import { VizPanelManager, VizPanelManagerState } from './VizPanelManager';

export interface PanelEditorState extends SceneObjectState {
  controls?: SceneObject[];
  isDirty?: boolean;
  panelId: number;
  optionsPane: PanelOptionsPane;
  optionsCollapsed?: boolean;
  optionsPaneSize: number;
  dataPane?: PanelDataPane;
  vizManager: VizPanelManager;
}

export class PanelEditor extends SceneObjectBase<PanelEditorState> {
  private _initialRepeatOptions: Pick<VizPanelManagerState, 'repeat' | 'repeatDirection' | 'maxPerRow'> = {};
  static Component = PanelEditorRenderer;

  private _discardChanges = false;

  public constructor(state: PanelEditorState) {
    super(state);

    const { repeat, repeatDirection, maxPerRow } = state.vizManager.state;
    this._initialRepeatOptions = {
      repeat,
      repeatDirection,
      maxPerRow,
    };

    this.addActivationHandler(this._activationHandler.bind(this));
  }

  private _activationHandler() {
    const panelManager = this.state.vizManager;
    const panel = panelManager.state.panel;

    this._subs.add(
      panelManager.subscribeToState((n, p) => {
        if (n.panel.state.pluginId !== p.panel.state.pluginId) {
          this._initDataPane(n.panel.state.pluginId);
        }
      })
    );

    this._initDataPane(panel.state.pluginId);

    return () => {
      if (!this._discardChanges) {
        this.commitChanges();
      }
    };
  }

  private _initDataPane(pluginId: string) {
    const skipDataQuery = config.panels[pluginId].skipDataQuery;

    if (skipDataQuery && this.state.dataPane) {
      locationService.partial({ tab: null }, true);
      this.setState({ dataPane: undefined });
    }

    if (!skipDataQuery && !this.state.dataPane) {
      this.setState({ dataPane: new PanelDataPane(this.state.vizManager) });
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
    this._discardChanges = true;
    locationService.partial({ editPanel: null });
  };

  public commitChanges() {
    const dashboard = getDashboardSceneFor(this);
    const sourcePanel = findVizPanelByKey(dashboard.state.body, getVizPanelKeyForPanelId(this.state.panelId));

    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }

    const panelManager = this.state.vizManager;

    const sourcePanelParent = sourcePanel!.parent;
    const sourcePanelGrandparent = sourcePanelParent!.parent!;
    if (!(sourcePanelGrandparent instanceof SceneGridLayout)) {
      console.error('Expected grandparent to be SceneGridLayout!');
      return;
    }

    const normalToRepeat = !this._initialRepeatOptions.repeat && panelManager.state.repeat;
    const repeatToNormal = this._initialRepeatOptions.repeat && !panelManager.state.repeat;

    if (sourcePanelParent instanceof SceneGridItem) {
      if (normalToRepeat) {
        const repeatDirection = panelManager.state.repeatDirection ?? 'h';
        const repeater = new PanelRepeaterGridItem({
          key: sourcePanelParent.state.key,
          x: sourcePanelParent.state.x,
          y: sourcePanelParent.state.y,
          width: repeatDirection === 'h' ? 24 : sourcePanelParent.state.width,
          height: sourcePanelParent.state.height,
          itemHeight: sourcePanelParent.state.height,
          source: panelManager.state.panel.clone(),
          variableName: panelManager.state.repeat!,
          repeatedPanels: [],
          repeatDirection: panelManager.state.repeatDirection,
          maxPerRow: panelManager.state.maxPerRow,
        });
        sourcePanelGrandparent.setState({
          children: sourcePanelGrandparent.state.children.map((child) =>
            child.state.key === sourcePanelParent.state.key ? repeater : child
          ),
        });
      } else {
        sourcePanelParent.setState({ body: panelManager.state.panel.clone() });
      }
    } else if (sourcePanelParent instanceof PanelRepeaterGridItem) {
      if (repeatToNormal) {
        const panelClone = panelManager.state.panel.clone();
        const gridItem = new SceneGridItem({
          key: sourcePanelParent.state.key,
          x: sourcePanelParent.state.x,
          y: sourcePanelParent.state.y,
          width: this._initialRepeatOptions.repeatDirection === 'h' ? 8 : sourcePanelParent.state.width,
          height: this._initialRepeatOptions.repeatDirection === 'v' ? 8 : sourcePanelParent.state.height,
          body: panelClone,
        });
        sourcePanelGrandparent.setState({
          children: sourcePanelGrandparent.state.children.map((child) =>
            child.state.key === sourcePanelParent.state.key ? gridItem : child
          ),
        });
      } else {
        sourcePanelParent.setState({ source: panelManager.state.panel.clone() });
      }
    } else {
      console.error('Unsupported scene object type');
    }
  }

  public toggleOptionsPane() {
    this.setState({ optionsCollapsed: !this.state.optionsCollapsed, optionsPaneSize: OPTIONS_PANE_FLEX_DEFAULT });
  }

  public onOptionsPaneResizing = (flexSize: number, pixelSize: number) => {
    if (flexSize <= 0 && pixelSize <= 0) {
      return;
    }

    const optionsPixelSize = (pixelSize / flexSize) * (1 - flexSize);

    if (this.state.optionsCollapsed && optionsPixelSize > OPTIONS_PANE_PIXELS_MIN) {
      this.setState({ optionsCollapsed: false });
    }

    if (!this.state.optionsCollapsed && optionsPixelSize < OPTIONS_PANE_PIXELS_MIN) {
      this.setState({ optionsCollapsed: true });
    }
  };

  public onOptionsPaneSizeChanged = (flexSize: number, pixelSize: number) => {
    if (flexSize <= 0 && pixelSize <= 0) {
      return;
    }

    const optionsPaneSize = 1 - flexSize;
    const isSnappedClosed = this.state.optionsPaneSize === 0;
    const fullWidth = pixelSize / flexSize;
    const snapWidth = OPTIONS_PANE_PIXELS_SNAP / fullWidth;

    if (this.state.optionsCollapsed) {
      if (isSnappedClosed) {
        this.setState({
          optionsPaneSize: Math.max(optionsPaneSize, snapWidth),
          optionsCollapsed: false,
        });
      } else {
        this.setState({ optionsPaneSize: 0 });
      }
    } else if (isSnappedClosed) {
      this.setState({ optionsPaneSize: optionsPaneSize });
    }
  };
}

export const OPTIONS_PANE_PIXELS_MIN = 300;
export const OPTIONS_PANE_PIXELS_SNAP = 400;
export const OPTIONS_PANE_FLEX_DEFAULT = 0.25;

export function buildPanelEditScene(panel: VizPanel): PanelEditor {
  const panelClone = panel.clone();
  const vizPanelMgr = new VizPanelManager(panelClone);
  if (panel.parent instanceof PanelRepeaterGridItem) {
    const { variableName: repeat, repeatDirection, maxPerRow } = panel.parent.state;

    vizPanelMgr.setState({
      repeat,
      repeatDirection,
      maxPerRow,
    });
  }

  return new PanelEditor({
    panelId: getPanelIdForVizPanel(panel),
    optionsPane: new PanelOptionsPane({}),
    vizManager: vizPanelMgr,
    optionsPaneSize: OPTIONS_PANE_FLEX_DEFAULT,
  });
}
