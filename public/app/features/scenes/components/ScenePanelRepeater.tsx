import React from 'react';

import { LoadingState, PanelData, DataFrame } from '@grafana/data';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { sceneGraph } from '../core/sceneGraph';
import {
  SceneComponentProps,
  SceneObject,
  SceneLayoutState,
  SceneLayoutChild,
  SceneLayoutChildState,
} from '../core/types';

interface RepeatOptions extends SceneLayoutChildState {
  layout: SceneObject<SceneLayoutState>;
  getLayoutChild(data: PanelData, frame: DataFrame, frameIndex: number): SceneLayoutChild;
}

export class ScenePanelRepeater extends SceneObjectBase<RepeatOptions> {
  public activate(): void {
    super.activate();

    this._subs.add(
      sceneGraph.getData(this).subscribeToState({
        next: (data) => {
          if (data.data?.state === LoadingState.Done) {
            this.performRepeat(data.data);
          }
        },
      })
    );
  }

  private performRepeat(data: PanelData) {
    const newChildren: SceneLayoutChild[] = [];

    for (let seriesIndex = 0; seriesIndex < data.series.length; seriesIndex++) {
      const layoutChild = this.state.getLayoutChild(data, data.series[seriesIndex], seriesIndex);
      newChildren.push(layoutChild);
    }

    this.state.layout.setState({ children: newChildren });
  }

  public static Component = ({ model, isEditing }: SceneComponentProps<ScenePanelRepeater>) => {
    const { layout } = model.useState();
    return <layout.Component model={layout} isEditing={isEditing} />;
  };
}
