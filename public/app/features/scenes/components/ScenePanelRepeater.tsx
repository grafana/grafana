import React from 'react';

import { LoadingState, PanelData } from '@grafana/data';

import { SceneDataNode } from '../core/SceneDataNode';
import { SceneObjectBase } from '../core/SceneObjectBase';
import {
  SceneComponentProps,
  SceneObject,
  SceneObjectStatePlain,
  SceneLayoutState,
  SceneLayoutChild,
} from '../core/types';

interface RepeatOptions extends SceneObjectStatePlain {
  layout: SceneObject<SceneLayoutState>;
}

export class ScenePanelRepeater extends SceneObjectBase<RepeatOptions> {
  activate(): void {
    super.activate();

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
    const newChildren: SceneLayoutChild[] = [];

    for (const series of data.series) {
      const clone = firstChild.clone({
        key: `${newChildren.length}`,
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

  static Component = ({ model, isEditing }: SceneComponentProps<ScenePanelRepeater>) => {
    const { layout } = model.useState();
    return <layout.Component model={layout} isEditing={isEditing} />;
  };
}
