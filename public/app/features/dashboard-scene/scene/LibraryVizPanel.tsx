import React from 'react';

import {
  SceneComponentProps,
  SceneGridItem,
  SceneGridLayout,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
  VizPanelMenu,
  VizPanelState,
} from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema';
import { PanelModel } from 'app/features/dashboard/state';
import { getLibraryPanel } from 'app/features/library-panels/state/api';

import { createPanelDataProvider } from '../utils/createPanelDataProvider';

import { VizPanelLinks, VizPanelLinksMenu } from './PanelLinks';
import { panelLinksBehavior, panelMenuBehavior } from './PanelMenuBehavior';
import { PanelNotices } from './PanelNotices';
import { PanelRepeaterGridItem } from './PanelRepeaterGridItem';

interface LibraryVizPanelState extends SceneObjectState {
  // Library panels use title from dashboard JSON's panel model, not from library panel definition, hence we pass it.
  title: string;
  uid: string;
  name: string;
  panel?: VizPanel;
  isLoaded?: boolean;
  panelKey: string;
  _loadedPanel?: LibraryPanel;
}

export class LibraryVizPanel extends SceneObjectBase<LibraryVizPanelState> {
  static Component = LibraryPanelRenderer;

  constructor(state: LibraryVizPanelState) {
    super({
      panel: state.panel ?? getLoadingPanel(state.title, state.panelKey),
      isLoaded: state.isLoaded ?? false,
      ...state,
    });

    this.addActivationHandler(this._onActivate);
  }

  private _onActivate = () => {
    if (!this.state.isLoaded) {
      this.loadLibraryPanelFromPanelModel();
    }
  };

  public setPanelFromLibPanel(libPanel: LibraryPanel) {
    if (this.state._loadedPanel?.version === libPanel.version) {
      return;
    }

    const libPanelModel = new PanelModel(libPanel.model);

    const vizPanelState: VizPanelState = {
      title: libPanelModel.title,
      key: this.state.panelKey,
      options: libPanelModel.options ?? {},
      fieldConfig: libPanelModel.fieldConfig,
      pluginId: libPanelModel.type,
      pluginVersion: libPanelModel.pluginVersion,
      displayMode: libPanelModel.transparent ? 'transparent' : undefined,
      description: libPanelModel.description,
      $data: createPanelDataProvider(libPanelModel),
      menu: new VizPanelMenu({ $behaviors: [panelMenuBehavior] }),
      titleItems: [
        new VizPanelLinks({
          rawLinks: libPanelModel.links,
          menu: new VizPanelLinksMenu({ $behaviors: [panelLinksBehavior] }),
        }),
        new PanelNotices(),
      ],
    };

    const panel = new VizPanel(vizPanelState);
    const gridItem = this.parent;

    if (libPanelModel.repeat && gridItem instanceof SceneGridItem && gridItem.parent instanceof SceneGridLayout) {
      this._parent = undefined;
      const repeater = new PanelRepeaterGridItem({
        key: gridItem.state.key,
        x: gridItem.state.x,
        y: gridItem.state.y,
        width: libPanelModel.repeatDirection === 'h' ? 24 : gridItem.state.width,
        height: gridItem.state.height,
        itemHeight: gridItem.state.height,
        source: this,
        variableName: libPanelModel.repeat,
        repeatedPanels: [],
        repeatDirection: libPanelModel.repeatDirection === 'h' ? 'h' : 'v',
        maxPerRow: libPanelModel.maxPerRow,
      });
      gridItem.parent.setState({
        children: gridItem.parent.state.children.map((child) =>
          child.state.key === gridItem.state.key ? repeater : child
        ),
      });
    }

    this.setState({ panel, _loadedPanel: libPanel, isLoaded: true, name: libPanel.name });
  }

  private async loadLibraryPanelFromPanelModel() {
    let vizPanel = this.state.panel!;

    try {
      const libPanel = await getLibraryPanel(this.state.uid, true);
      this.setPanelFromLibPanel(libPanel);
    } catch (err) {
      vizPanel.setState({
        _pluginLoadError: `Unable to load library panel: ${this.state.uid}`,
      });
    }
  }
}

function getLoadingPanel(title: string, panelKey: string) {
  return new VizPanel({
    key: panelKey,
    title,
    menu: new VizPanelMenu({
      $behaviors: [panelMenuBehavior],
    }),
  });
}

function LibraryPanelRenderer({ model }: SceneComponentProps<LibraryVizPanel>) {
  const { panel } = model.useState();

  if (!panel) {
    return null;
  }

  return <panel.Component model={panel} />;
}
