import React from 'react';

import { LoadingState, PanelData, DataFrame } from '@grafana/data';
import {
  SceneObjectState,
  SceneFlexItem,
  SceneObjectBase,
  sceneGraph,
  SceneComponentProps,
  SceneByFrameRepeater,
  SceneLayout,
} from '@grafana/scenes';

interface ByFrameRepeaterState extends SceneObjectState {
  body: SceneLayout;
  getLayoutChild(data: PanelData, frame: DataFrame, frameIndex: number): SceneFlexItem;
}

export class ByFrameRepeater extends SceneObjectBase<ByFrameRepeaterState> {
  public constructor(state: ByFrameRepeaterState) {
    super(state);

    this.addActivationHandler(() => {
      const data = sceneGraph.getData(this);

      this._subs.add(
        data.subscribeToState((data) => {
          if (data.data?.state === LoadingState.Done) {
            this.performRepeat(data.data);
          }
        })
      );

      if (data.state.data) {
        this.performRepeat(data.state.data);
      }
    });
  }

  private performRepeat(data: PanelData) {
    const newChildren: SceneFlexItem[] = [];

    for (let seriesIndex = 0; seriesIndex < data.series.length; seriesIndex++) {
      const layoutChild = this.state.getLayoutChild(data, data.series[seriesIndex], seriesIndex);
      newChildren.push(layoutChild);
    }

    this.state.body.setState({ children: newChildren });
  }

  public static Component = ({ model }: SceneComponentProps<SceneByFrameRepeater>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}
