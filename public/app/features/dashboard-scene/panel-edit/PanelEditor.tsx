import * as H from 'history';

import { NavIndex } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  SceneFlexItem,
  SceneFlexLayout,
  SceneGridItem,
  SceneGridLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SplitLayout,
  VizPanel,
} from '@grafana/scenes';

import { PanelRepeaterGridItem } from '../scene/PanelRepeaterGridItem';
import { getDashboardUrl } from '../utils/urlBuilders';
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

  public constructor(state: PanelEditorState) {
    super(state);
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
    // Open question on what to preserve when going back
    // Preserve time range, and variables state (that might have been changed while in panel edit)
    // Preserve current panel data? (say if you just changed the time range and have new data)
    this._navigateBackToDashboard();
  };

  public onApply = () => {
    this._commitChanges();
    this._navigateBackToDashboard();
  };

  public onSave = () => {
    this._commitChanges();
    // Open dashboard save drawer
  };

  private _commitChanges() {
    const dashboard = getDashboardSceneFor(this);
    const sourcePanel = findVizPanelByKey(dashboard.state.body, getVizPanelKeyForPanelId(this.state.panelId));

    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }

    const panelMngr = this.state.panelRef.resolve();

    const sourcePanelParent = sourcePanel!.parent;
    const sourcePanelGrandparent = sourcePanelParent!.parent!;
    if (!(sourcePanelGrandparent instanceof SceneGridLayout)) {
      console.error('Expected grandparent to be SceneGridLayout!');
      return;
    }

    const normalToRepeat = !sourcePanel!.state.repeat && panelMngr.state.panel.state.repeat;
    const repeatToNormal = sourcePanel!.state.repeat && !panelMngr.state.panel.state.repeat;

    if (sourcePanelParent instanceof SceneGridItem) {
      if (normalToRepeat) {
        const panel = panelMngr.state.panel;
        const repeatDirection = panel.state.repeatDirection ?? 'h';
        const repeater = new PanelRepeaterGridItem({
          key: sourcePanelParent.state.key,
          x: sourcePanelParent.state.x,
          y: sourcePanelParent.state.y,
          width: repeatDirection === 'h' ? 24 : sourcePanelParent.state.width,
          height: sourcePanelParent.state.height,
          itemHeight: sourcePanelParent.state.height,
          source: panelMngr.state.panel.clone(),
          variableName: panel.state.repeat!,
          repeatedPanels: [],
          repeatDirection: panel.state.repeatDirection,
          maxPerRow: panel.state.maxPerRow,
        });
        sourcePanelGrandparent.setState({
          children: sourcePanelGrandparent.state.children.map((child) =>
            child.state.key === sourcePanelParent.state.key ? repeater : child
          ),
        });
      } else {
        sourcePanelParent.setState({ body: panelMngr.state.panel.clone() });
      }
    } else if (sourcePanelParent instanceof PanelRepeaterGridItem) {
      if (repeatToNormal) {
        const panelClone = panelMngr.state.panel.clone();
        panelClone.setState({ repeat: undefined, repeatDirection: undefined, maxPerRow: undefined });
        const gridItem = new SceneGridItem({
          key: sourcePanelParent.state.key,
          x: sourcePanelParent.state.x,
          y: sourcePanelParent.state.y,
          width: sourcePanel!.state.repeatDirection === 'h' ? 8 : sourcePanelParent.state.width,
          height: sourcePanel!.state.repeatDirection === 'v' ? 8 : sourcePanelParent.state.height,
          body: panelClone,
        });
        sourcePanelGrandparent.setState({
          children: sourcePanelGrandparent.state.children.map((child) =>
            child.state.key === sourcePanelParent.state.key ? gridItem : child
          ),
        });
      } else {
        sourcePanelParent.setState({ source: panelMngr.state.panel.clone() });
      }
    } else {
      console.error('Unsupported scene object type');
    }

    dashboard.setState({
      isDirty: true,
    });
  }

  private _navigateBackToDashboard() {
    const dashboard = getDashboardSceneFor(this);
    locationService.push(
      getDashboardUrl({
        uid: dashboard.state.uid,
        slug: dashboard.state.meta.slug,
        currentQueryParams: locationService.getLocation().search,
        updateQuery: {
          editPanel: null,
          // Clean the PanelEditor data pane tab query param
          tab: null,
        },
      })
    );
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
      primary: new SplitLayout({
        direction: 'column',
        primary: new SceneFlexLayout({
          direction: 'column',
          minHeight: 200,
          children: [vizPanelMgr],
        }),
        secondary: new SceneFlexItem({
          body: new PanelDataPane(vizPanelMgr),
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
