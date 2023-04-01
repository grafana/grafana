import { Unsubscribable } from 'rxjs';

import {
  SceneDataProvider,
  SceneDataState,
  SceneDataTransformer,
  SceneDeactivationHandler,
  SceneObject,
  SceneObjectBase,
} from '@grafana/scenes';
import { DashboardQuery } from 'app/plugins/datasource/dashboard/types';

import { getVizPanelKeyForPanelId } from './utils';

export interface ShareQueryDataProviderState extends SceneDataState {
  query: DashboardQuery;
}

export class ShareQueryDataProvider extends SceneObjectBase<ShareQueryDataProviderState> implements SceneDataProvider {
  private _querySub: Unsubscribable | undefined;
  private _sourceDataDeactivationHandler?: SceneDeactivationHandler;

  public constructor(state: ShareQueryDataProviderState) {
    super(state);

    this.addActivationHandler(() => {
      // TODO handle changes to query model (changed panelId / withTransforms)
      //this.subscribeToState(this._onStateChanged);

      this.subscribeToSource();

      return () => {
        if (this._querySub) {
          this._querySub.unsubscribe();
        }
        if (this._sourceDataDeactivationHandler) {
          this._sourceDataDeactivationHandler();
        }
      };
    });
  }

  public subscribeToSource() {
    const { query } = this.state;

    if (this._querySub) {
      this._querySub.unsubscribe();
    }

    if (!query.panelId) {
      return;
    }

    const keyToFind = getVizPanelKeyForPanelId(query.panelId);
    const source = findObjectInScene(this.getRoot(), (scene: SceneObject) => scene.state.key === keyToFind);

    if (!source) {
      console.log('Shared dashboard query refers to a panel that does not exist in the scene');
      return;
    }

    let sourceData = source.state.$data;
    if (!sourceData) {
      console.log('No source data found for shared dashboard query');
      return;
    }

    // This will activate if sourceData is part of hidden panel
    // Also make sure the sourceData is not deactivated if hidden later
    this._sourceDataDeactivationHandler = sourceData.activate();

    if (sourceData instanceof SceneDataTransformer) {
      if (!query.withTransforms) {
        if (!sourceData.state.$data) {
          throw new Error('No source inner query runner found in data transformer');
        }
        sourceData = sourceData.state.$data;
      }
    }

    this._querySub = sourceData.subscribeToState((state) => this.setState({ data: state.data }));

    // Copy the initial state
    this.setState({ data: sourceData.state.data });
  }
}

export function findObjectInScene(scene: SceneObject, check: (scene: SceneObject) => boolean): SceneObject | null {
  if (check(scene)) {
    return scene;
  }

  let found: SceneObject | null = null;

  scene.forEachChild((child) => {
    let maybe = findObjectInScene(child, check);
    if (maybe) {
      found = maybe;
    }
  });

  return found;
}
