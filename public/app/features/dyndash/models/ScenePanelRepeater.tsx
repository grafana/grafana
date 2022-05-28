import React from 'react';

import { LoadingState, PanelData } from '@grafana/data';

import { SceneDataNode } from './SceneDataNode';
import { SceneItemBase } from './SceneItem';
import { SceneComponentProps, SceneItem, SceneItemList, SceneItemState, SceneLayoutState } from './types';

interface RepeatOptions extends SceneItemState {
  layout: SceneItem<SceneLayoutState>;
}

export class ScenePanelRepeater extends SceneItemBase<RepeatOptions> {
  onMount() {
    super.onMount();

    this.subs.add(
      this.getData().subscribe({
        next: (data) => {
          if (data.data?.state === LoadingState.Done) {
            this.performRepeat(data.data);
          }
        },
      })
    );
  }

  performRepeat(data: PanelData) {
    // assume parent is a layout
    const firstChild = this.state.layout.state.children[0]!;
    const newChildren: SceneItemList = [];

    for (const series of data.series) {
      const clone = firstChild.clone({
        $data: new SceneDataNode({
          data: {
            ...data,
            series: [series],
          },
        }),
      });

      newChildren.push(clone);
    }

    this.state.layout.setState({ children: newChildren });
  }

  Component = ({ model }: SceneComponentProps<ScenePanelRepeater>) => {
    const { layout } = model.useState();
    return <layout.Component model={layout} />;
  };
}
