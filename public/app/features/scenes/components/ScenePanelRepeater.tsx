import React from 'react';
import { v4 as uuidv4 } from 'uuid';

import { LoadingState, PanelData } from '@grafana/data';

import { SceneDataNode } from '../core/SceneDataNode';
import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneObject, SceneObjectList, SceneObjectState, SceneLayoutState } from '../core/types';

interface RepeatOptions extends SceneObjectState {
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
    const newChildren: SceneObjectList = [];

    for (const series of data.series) {
      const clone = firstChild.clone({
        // Setting key to guid here will cause unmount / remount on every refresh
        // To preserve children between refreshes we need to figure out how to instead update objects
        key: uuidv4(),
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
