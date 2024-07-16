import { Unsubscribable } from 'rxjs';

import { SceneObjectBase, SceneObjectState, VizPanel, VizPanelState } from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema';
import { PanelModel } from 'app/features/dashboard/state';
import { getLibraryPanel, libraryVizPanelToSaveModel } from 'app/features/library-panels/state/api';

import { createPanelDataProvider } from '../utils/createPanelDataProvider';

import { DashboardGridItem } from './DashboardGridItem';

interface LibraryPanelBehaviorState extends SceneObjectState {
  // Library panels use title from dashboard JSON's panel model, not from library panel definition, hence we pass it.
  title?: string;
  uid: string;
  name: string;
  isLoaded?: boolean;
  _loadedPanel?: LibraryPanel;
}

export class LibraryPanelBehavior extends SceneObjectBase<LibraryPanelBehaviorState> {
  private _libPanelSubscription: Unsubscribable | undefined;

  public constructor(state: LibraryPanelBehaviorState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    if (!this.state.isLoaded) {
      this.loadLibraryPanelFromPanelModel();
    }

    const vizPanel = this.parent;

    if (vizPanel instanceof VizPanel) {
      this._libPanelSubscription = vizPanel.subscribeToState((newState, prevState) => {
        if (newState !== prevState) {
          const _loadedPanel = libraryVizPanelToSaveModel(vizPanel);

          if (this.state._loadedPanel !== _loadedPanel) {
            console.log('UPDATING _loadedPanel');
            this.setState({ _loadedPanel });
          }
        }
      });
    }

    return () => {
      console.log('UNSUBBED');
      this._libPanelSubscription?.unsubscribe();
      this._libPanelSubscription = undefined;
    };
  }

  public setPanelFromLibPanel(libPanel: LibraryPanel) {
    if (this.state._loadedPanel?.version === libPanel.version) {
      return;
    }

    const vizPanel = this.parent;

    if (!(vizPanel instanceof VizPanel)) {
      return;
    }

    const gridItem = vizPanel.parent;

    if (!(gridItem instanceof DashboardGridItem)) {
      return;
    }

    const libPanelModel = new PanelModel(libPanel.model);

    const vizPanelState: VizPanelState = {
      title: libPanelModel.title,
      options: libPanelModel.options ?? {},
      fieldConfig: libPanelModel.fieldConfig,
      pluginId: libPanelModel.type,
      pluginVersion: libPanelModel.pluginVersion,
      displayMode: libPanelModel.transparent ? 'transparent' : undefined,
      description: libPanelModel.description,
      $data: createPanelDataProvider(libPanelModel),
    };

    this.setState({ _loadedPanel: libPanel, isLoaded: true, name: libPanel.name });

    const clone = vizPanel.clone(vizPanelState);
    gridItem.setState({ body: clone });
  }

  private async loadLibraryPanelFromPanelModel() {
    let vizPanel = this.parent;

    if (!(vizPanel instanceof VizPanel)) {
      return;
    }

    try {
      const libPanel = await getLibraryPanel(this.state.uid, true);
      this.setPanelFromLibPanel(libPanel);
      if (vizPanel.parent instanceof DashboardGridItem) {
        vizPanel.parent.setState({
          variableName: libPanel.model.repeat,
          repeatDirection: libPanel.model.repeatDirection === 'h' ? 'h' : 'v',
          maxPerRow: libPanel.model.maxPerRow,
        });
      }
    } catch (err) {
      vizPanel.setState({
        _pluginLoadError: `Unable to load library panel: ${this.state.uid}`,
      });
    }
  }
}
