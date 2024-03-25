import React from 'react';

import { LoadingState, PanelData, DataFrame } from '@grafana/data';
import {
  SceneObjectState,
  SceneFlexItem,
  SceneObjectBase,
  sceneGraph,
  SceneComponentProps,
  SceneLayout,
  SceneDataNode,
} from '@grafana/scenes';

import { StatusWrapper } from '../StatusWrapper';

import { findSceneObjectsByType } from './utils';

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
        data.subscribeToState((newState, oldState) => {
          if (newState.data === undefined) {
            return;
          }

          const newData = newState.data;

          if (newState.data !== undefined && newState.data?.state !== oldState.data?.state) {
            findSceneObjectsByType(this, SceneDataNode).forEach((dataNode) => {
              dataNode.setState({ data: { ...dataNode.state.data, state: newData.state } });
            });
          }
          if (newData.state === LoadingState.Done) {
            this.performRepeat(newData);
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
      const frame = data.series[seriesIndex];
      if (frame.length <= 1) {
        // If the data doesn't have at least two points, we skip it.
        continue;
      }
      const layoutChild = this.state.getLayoutChild(data, frame, seriesIndex);
      newChildren.push(layoutChild);
    }

    this.state.body.setState({ children: newChildren });
    this.setState({ body: this.state.body });
  }

  public static Component = ({ model }: SceneComponentProps<ByFrameRepeater>) => {
    const { body } = model.useState();
    const { children } = body.useState();

    const data = sceneGraph.getData(model);
    const sceneDataState = data.useState();

    const panelData = sceneDataState?.data;

    const isLoading = panelData?.state === 'Loading' && children.length === 0;
    const error = panelData?.state === LoadingState.Error ? 'Failed to load data.' : undefined;
    const blockingMessage =
      !isLoading && children.length === 0 && !error
        ? 'There is no data available. Try adjusting your filters, adjusting your time range, or selecting a different label.'
        : undefined;

    return (
      <StatusWrapper {...{ blockingMessage, error, isLoading }}>
        <body.Component model={body} />
      </StatusWrapper>
    );
  };
}
