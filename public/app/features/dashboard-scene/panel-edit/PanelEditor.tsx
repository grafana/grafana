import * as H from 'history';

import { NavIndex } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import {
  SceneFlexItem,
  SceneFlexLayout,
  SceneGridItem,
  SceneObject,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SplitLayout,
  VizPanel,
} from '@grafana/scenes';

import {
  findVizPanelByKey,
  getDashboardSceneFor,
  getPanelIdForVizPanel,
  getVizPanelKeyForPanelId,
} from '../utils/utils';

import { PanelDataPane } from './PanelDataPane/PanelDataPane';
import { PanelEditorRenderer } from './PanelEditorRenderer';
import { PanelOptionsPane } from './PanelOptionsPane';
import { VizPanelManager } from './VizPanelManager';

export interface PanelEditorState extends SceneObjectState {
  body: SceneObject;
  controls?: SceneObject[];
  isDirty?: boolean;
  panelId: number;
  panelRef: SceneObjectRef<VizPanelManager>;
}

export class PanelEditor extends SceneObjectBase<PanelEditorState> {
  static Component = PanelEditorRenderer;

  private _discardChanges = false;

  public constructor(state: PanelEditorState) {
    super(state);

    this.addActivationHandler(() => {
      return () => {
        if (!this._discardChanges) {
          this.commitChanges();
        }
      };
    });
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

    const panelMngr = this.state.panelRef.resolve();

    if (sourcePanel!.parent instanceof SceneGridItem) {
      sourcePanel!.parent.setState({ body: panelMngr.state.panel.clone() });
    }
  }
}

export function buildPanelEditScene(panel: VizPanel): PanelEditor {
  const panelClone = panel.clone();
  const vizPanelMgr = new VizPanelManager(panelClone);

  return new PanelEditor({
    panelId: getPanelIdForVizPanel(panel),
    panelRef: vizPanelMgr.getRef(),
    body: new SplitLayout({
      direction: 'row',
      initialSize: 0.75,
      primary: new SplitLayout({
        direction: 'column',
        $behaviors: [conditionalDataPaneBehavior],
        primary: new SceneFlexLayout({
          direction: 'column',
          minHeight: 200,
          children: [vizPanelMgr],
        }),
        primaryPaneStyles: {
          minHeight: 0,
          overflow: 'hidden',
        },
        secondaryPaneStyles: {
          minHeight: 0,
        },
      }),
      secondary: new SceneFlexItem({
        body: new PanelOptionsPane(vizPanelMgr),
        width: '100%',
      }),
      primaryPaneStyles: {
        minWidth: '0',
      },
      secondaryPaneStyles: {
        minWidth: '0',
      },
    }),
  });
}

// This function is used to conditionally add the data pane to the panel editor,
// depending on the type of a panel being edited.
function conditionalDataPaneBehavior(scene: SplitLayout) {
  const dashboard = getDashboardSceneFor(scene);

  const editor = dashboard.state.editPanel;

  if (!editor) {
    return;
  }

  const panelManager = editor.state.panelRef.resolve();
  const panel = panelManager.state.panel;

  const getDataPane = () =>
    new SceneFlexItem({
      body: new PanelDataPane(panelManager),
    });

  if (!config.panels[panel.state.pluginId].skipDataQuery) {
    scene.setState({
      secondary: getDataPane(),
    });
  }

  const sub = panelManager.subscribeToState((n, p) => {
    const hadDataSupport = !config.panels[p.panel.state.pluginId].skipDataQuery;
    const willHaveDataSupport = !config.panels[n.panel.state.pluginId].skipDataQuery;

    if (hadDataSupport && !willHaveDataSupport) {
      locationService.partial({ tab: null }, true);
      scene.setState({ secondary: undefined });
    } else if (!hadDataSupport && willHaveDataSupport) {
      scene.setState({ secondary: getDataPane() });
    }
  });

  return () => {
    sub.unsubscribe();
  };
}
