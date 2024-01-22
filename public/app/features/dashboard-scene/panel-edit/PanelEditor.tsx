import * as H from 'history';

import { NavIndex } from '@grafana/data';
import { locationService } from '@grafana/runtime';
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

    if (sourcePanel!.parent instanceof SceneGridItem) {
      sourcePanel!.parent.setState({ body: panelMngr.state.panel.clone() });
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
    }),
  });
}
