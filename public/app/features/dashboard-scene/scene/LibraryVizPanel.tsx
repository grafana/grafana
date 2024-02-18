import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel, VizPanelMenu } from '@grafana/scenes';
import { PanelModel } from 'app/features/dashboard/state';
import { getLibraryPanel } from 'app/features/library-panels/state/api';

import { createPanelDataProvider } from '../utils/createPanelDataProvider';

import { panelMenuBehavior } from './PanelMenuBehavior';

interface LibraryVizPanelState extends SceneObjectState {
  // Library panels use title from dashboard JSON's panel model, not from library panel definition, hence we pass it.
  title: string;
  uid: string;
  name: string;
  panel: VizPanel;
}

export class LibraryVizPanel extends SceneObjectBase<LibraryVizPanelState> {
  static Component = LibraryPanelRenderer;

  constructor({ uid, title, key, name }: Pick<LibraryVizPanelState, 'uid' | 'title' | 'key' | 'name'>) {
    super({
      uid,
      title,
      key,
      name,
      panel: new VizPanel({
        title,
        menu: new VizPanelMenu({
          $behaviors: [panelMenuBehavior],
        }),
      }),
    });

    this.addActivationHandler(this._onActivate);
  }

  private _onActivate = () => {
    this.loadLibraryPanelFromPanelModel();
  };

  private async loadLibraryPanelFromPanelModel() {
    let vizPanel = this.state.panel;
    try {
      const libPanel = await getLibraryPanel(this.state.uid, true);
      const libPanelModel = new PanelModel(libPanel.model);
      vizPanel = vizPanel.clone({
        options: libPanelModel.options ?? {},
        fieldConfig: libPanelModel.fieldConfig,
        pluginVersion: libPanelModel.pluginVersion,
        displayMode: libPanelModel.transparent ? 'transparent' : undefined,
        description: libPanelModel.description,
        pluginId: libPanel.type,
        $data: createPanelDataProvider(libPanelModel),
      });
    } catch (err) {
      vizPanel.setState({
        _pluginLoadError: 'Unable to load library panel: ' + this.state.uid,
      });
    }

    this.setState({ panel: vizPanel });
  }
}

function LibraryPanelRenderer({ model }: SceneComponentProps<LibraryVizPanel>) {
  const { panel } = model.useState();

  if (!panel) {
    return null;
  }

  return <panel.Component model={panel} />;
}
