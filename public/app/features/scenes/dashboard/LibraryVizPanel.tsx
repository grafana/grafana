import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { LibraryPanel, LibraryPanelRef } from '@grafana/schema';
import { PanelModel } from 'app/features/dashboard/state';
import { getLibraryPanel } from 'app/features/library-panels/state/api';

import { createPanelDataProvider } from './utils/createPanelDataProvider';

interface LibraryVizPanelState extends SceneObjectState {
  title: string;
  libraryPanel: LibraryPanelRef | LibraryPanel;
  panel?: VizPanel;
}

export class LibraryVizPanel extends SceneObjectBase<LibraryVizPanelState> {
  static Component = LibraryPanelRenderer;

  constructor({ libraryPanel, title }: Pick<LibraryVizPanelState, 'libraryPanel' | 'title'>) {
    super({ libraryPanel, title });

    this.addActivationHandler(this._onActivate);
  }

  private _onActivate = () => {
    this.loadLibraryPanelFromPanelModel();
  };

  private async loadLibraryPanelFromPanelModel() {
    const { title } = this.state;
    let vizPanel = new VizPanel({ title });
    try {
      const libPanel = await getLibraryPanel(this.state.libraryPanel.uid, true);
      const libPanelModel = new PanelModel(libPanel.model);
      vizPanel.setState({
        options: libPanelModel.options ?? {},
        fieldConfig: libPanelModel.fieldConfig,
        pluginVersion: libPanelModel.pluginVersion,
        displayMode: libPanelModel.transparent ? 'transparent' : undefined,
        $data: createPanelDataProvider(libPanelModel),
      });
    } catch (err) {
      vizPanel.setState({
        pluginLoadError: 'Unable to load library panel: ' + this.state.libraryPanel.uid,
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
