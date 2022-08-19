import React from 'react';

import { LoadingState, PanelData } from '@grafana/data';

import { SceneDataNode } from '../core/SceneDataNode';
import { SceneObjectBase } from '../core/SceneObjectBase';
import {
  SceneComponentProps,
  // SceneObject,
  SceneObjectStatePlain,
  SceneLayoutState,
  SceneObject,
} from '../core/types';

interface RepeatOptions extends SceneObjectStatePlain, SceneLayoutState {}

export class ScenePanelRepeater extends SceneObjectBase<RepeatOptions> {
  private repeatableChildren: SceneObject[] = [];
  constructor(state: RepeatOptions) {
    super(state);
    this.repeatableChildren = state.children;
  }
  activate(): void {
    super.activate();

    this.subs.add(
      this.getData().subscribe({
        next: (data) => {
          if (data.$data?.state === LoadingState.Done) {
            this.performRepeat(data.$data);
          }
        },
      })
    );
  }

  performRepeat(data: PanelData) {
    const nextChildren = [];
    for (const series of data.series) {
      nextChildren.push(
        new SceneDataNode({
          $data: { ...data, series: [series] },
          children: this.repeatableChildren.map((c) => c.clone()),
        })
      );
    }

    this.setState({ children: nextChildren });
  }

  static Component = ({ model, isEditing }: SceneComponentProps<ScenePanelRepeater>) => {
    const { children } = model.useState();
    return (
      <>
        {children.map((child) => (
          <child.Component key={child.state.key} model={child} isEditing={isEditing} />
        ))}
      </>
    );
  };
}
