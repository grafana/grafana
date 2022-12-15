import { Observable, of, Unsubscribable } from 'rxjs';

import { DataTransformerConfig, LoadingState, PanelData } from '@grafana/data';

import { getTransformationsStream } from '../querying/SceneQueryRunner';

import { SceneObjectBase } from './SceneObjectBase';
import { sceneGraph } from './sceneGraph';
import { SceneDataState } from './types';

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

    const initialData = sceneGraph.getData(this.parent.parent).state.data;

    if (initialData) {
      this.transformData(of(initialData));
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
    if (this._transformationsSub) {
      this._transformationsSub.unsubscribe();
      this._transformationsSub = undefined;
    }

    this._transformationsSub = data.pipe(getTransformationsStream(this, this.state.transformations)).subscribe({
      next: (data) => {
        this.setState({ data });
      },
    });
  }
}
