import React from 'react';

import { LoadingState, PanelData } from '@grafana/data';

import { SceneDataNode } from '../core/SceneDataNode';
import { SceneDataObject, SceneObjectBase } from '../core/SceneObjectBase';
import {
  SceneComponentProps,
  SceneObjectStatePlain,
  SceneLayoutChild,
  SceneParametrizedState,
  DataInputParams,
  SceneDataState,
  SceneLayout,
} from '../core/types';

import { VizPanel } from './VizPanel';

interface RepeatOptions<TState extends SceneDataState, T extends SceneDataObject<TState> = SceneDataObject<TState>>
  extends SceneObjectStatePlain,
    SceneParametrizedState<DataInputParams<TState, T>> {
  panel: VizPanel;
  layout: SceneLayout;
}

export class ScenePanelRepeater extends SceneObjectBase<RepeatOptions<any, any>> {
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
    // assume parent is a layout
    const panel = this.state.panel;
    const newChildren: SceneLayoutChild[] = [];

    for (const series of data.series) {
      const clone = panel.clone({
        key: `${newChildren.length}`,
        inputParams: {
          data: new SceneDataNode({
            $data: {
              ...data,
              series: [series],
            },
          }),
        },
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
