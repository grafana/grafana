import { DataTransformerConfig, LoadingState, PanelData, transformDataFrame } from '@grafana/data';
import { map } from 'rxjs';
import { SceneDataObject } from './SceneObjectBase';

import { SceneDataState, SceneParametrizedState } from './types';

type SceneDataTransformationParams = {
  data: SceneDataObject<any>;
};

export interface SceneDataTransformationNodeState
  extends SceneDataState,
    SceneParametrizedState<SceneDataTransformationParams> {
  transformations: DataTransformerConfig[];
}

export class SceneDataTransformationNode extends SceneDataObject<SceneDataTransformationNodeState> {
  activate(): void {
    super.activate();
    this.subs.add(
      this.state.inputParams.data.subscribe({
        next: (next) => {
          if (next.$data && next.$data.state === LoadingState.Done) {
            transformDataFrame(this.state.transformations, next.$data?.series)
              .pipe(map((series) => ({ ...next.$data, series } as PanelData)))
              .subscribe((data) => {
                console.log('trasforming');
                this.setState({ $data: data });
              });
          }
        },
      })
    );
  }

  toJSON() {
    return {
      transformations: [...this.state.transformations],
    };
  }
}
