import { Observable, of, Unsubscribable } from 'rxjs';

import { DataTransformerConfig, LoadingState, PanelData } from '@grafana/data';

import { getTransformationsStream } from '../querying/SceneQueryRunner';

import { SceneObjectBase } from './SceneObjectBase';
import { sceneGraph } from './sceneGraph';
import { SceneDataState, SceneObjectStatePlain } from './types';

export interface SceneDataNodeState extends SceneObjectStatePlain {
  data?: PanelData;
}

export class SceneDataNode extends SceneObjectBase<SceneDataNodeState> {}

export interface SceneDataTransformerState extends SceneDataState {
  transformations?: DataTransformerConfig[];
}

export class SceneDataTransformer extends SceneObjectBase<SceneDataTransformerState> {
  private _transformationsSub?: Unsubscribable;

  public activate() {
    super.activate();

    if (!this.parent || !this.parent.parent) {
      return;
    }
    this._subs.add(
      // Need to subscribe to the parent's parent because the parent has a $data reference to this object
      sceneGraph.getData(this.parent.parent).subscribeToState({
        next: (data) => {
          if (data.data?.state === LoadingState.Done) {
            this.transformData(of(data.data));
          }
        },
      })
    );
  }

  public deactivate(): void {
    super.deactivate();

    if (this._transformationsSub) {
      this._transformationsSub.unsubscribe();
      this._transformationsSub = undefined;
    }
  }

  private transformData(data: Observable<PanelData>) {
    this._transformationsSub = data.pipe(getTransformationsStream(this.state.transformations)).subscribe({
      next: (data) => {
        this.setState({ data });
      },
    });
  }
}
