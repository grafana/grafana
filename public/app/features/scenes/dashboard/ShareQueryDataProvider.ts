import { Unsubscribable } from 'rxjs';

import {
  SceneDataProvider,
  SceneDataState,
  SceneDataTransformer,
  SceneObject,
  SceneObjectBase,
  SceneQueryRunner,
} from '@grafana/scenes';
import { DashboardQuery } from 'app/plugins/datasource/dashboard/types';

import { getVizPanelKeyForPanelId } from './utils';

export interface ShareQueryDataProviderState extends SceneDataState {
  query: DashboardQuery;
}

export class ShareQueryDataProvider extends SceneObjectBase<ShareQueryDataProviderState> implements SceneDataProvider {
  private _querySub: Unsubscribable | undefined;

  public constructor(state: ShareQueryDataProviderState) {
    super(state);

    this.addActivationHandler(() => {
      // TODO handle changes to query model (changed panelId / withTransforms)
      //this.subscribeToState(this._onStateChanged);
      this.subscribeToSource();
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

    const sourceData = source.state.$data;
    if (!sourceData) {
      console.log('No source data found for shared dashboard query');
      return;
    }

    if (!sourceData?.isActive) {
      // TODO, not sure the best way to handle this, how to handle deactivation of the source when we activated it?
      sourceData?.activate();
    }

    if (sourceData instanceof SceneQueryRunner) {
      this._querySub = sourceData.subscribeToState((state) => this.setState({ data: state.data }));
    }

    if (sourceData instanceof SceneDataTransformer) {
      if (query.withTransforms) {
        this._querySub = sourceData.subscribeToState((state) => this.setState({ data: state.data }));
      } else {
        this._querySub = sourceData.state.$data!.subscribeToState((state) => this.setState({ data: state.data }));
      }
    }
  }
}

export function findObjectInScene(scene: SceneObject, check: (scene: SceneObject) => boolean): SceneObject | null {
  if (check(scene)) {
    return scene;
  }

  for (const propValue of Object.values(scene.state)) {
    if (propValue instanceof SceneObjectBase) {
      const found = findObjectInScene(propValue, check);
      if (found) {
        return found;
      }
    }

    if (Array.isArray(propValue)) {
      for (const child of propValue) {
        if (child instanceof SceneObjectBase) {
          const found = findObjectInScene(child, check);
          if (found) {
            return found;
          }
        }
      }
    }
  }

  return null;
}
