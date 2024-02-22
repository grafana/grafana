import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel, VizPanelMenu } from '@grafana/scenes';
import { PanelModel } from 'app/features/dashboard/state';
import { getLibraryPanel } from 'app/features/library-panels/state/api';

import { createPanelDataProvider } from '../utils/createPanelDataProvider';

import { VizPanelLinks, VizPanelLinksMenu } from './PanelLinks';
import { panelLinksBehavior, panelMenuBehavior } from './PanelMenuBehavior';
import { PanelNotices } from './PanelNotices';

interface LibraryVizPanelState extends SceneObjectState {
  // Library panels use title from dashboard JSON's panel model, not from library panel definition, hence we pass it.
  title: string;
  uid: string;
  name: string;
  panel?: VizPanel;
  isLoaded?: boolean;
  panelKey: string;
  _loadedVersion?: number;
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

  private async loadLibraryPanelFromPanelModel() {
    let vizPanel = this.state.panel!;

    try {
      const libPanel = await getLibraryPanel(this.state.uid, true);

      if (this.state._loadedVersion === libPanel.version) {
        return;
      }

      const libPanelModel = new PanelModel(libPanel.model);

      const panel = new VizPanel({
        title: this.state.title,
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
      });

      this.setState({ panel, _loadedVersion: libPanel.version, isLoaded: true });
    } catch (err) {
      vizPanel.setState({
        _pluginLoadError: 'Unable to load library panel: ' + this.state.uid,
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
