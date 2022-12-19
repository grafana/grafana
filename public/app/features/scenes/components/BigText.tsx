import React from 'react';

import { Button } from '@grafana/ui';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneLayoutChildState } from '../core/types';

export interface BigTextState extends SceneLayoutChildState {
  text: string;
  fontSize: number;
}

export class BigText extends SceneObjectBase<BigTextState> {
  public static Component = BigTextRenderer;

  public onIncrement = () => {
    this.setState({ fontSize: this.state.fontSize + 1 });
  };
}

function BigTextRenderer({ model }: SceneComponentProps<BigText>) {
  const { text, fontSize } = model.useState();

  return (
    <div style={{ fontSize: fontSize }}>
      <div>{text}</div>
      <Button onClick={model.onIncrement}>Increment font size</Button>
    </div>
  );
}

//
//
//
//
//
//

// const { data } = sceneGraph.getData(model).useState();

// public activate() {
//     this._subs.add(sceneGraph.getTimeRange(this).subscribeToState({
//       next: (timeRange) => {
//         this.setState({ text: timeRange.from.toString() });
//       },
//     }));
//   }

// public onIncrement = () => {
//     this.setState({ fontSize: this.state.fontSize + 1 });
//   };
