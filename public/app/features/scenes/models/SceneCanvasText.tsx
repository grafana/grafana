import React, { CSSProperties } from 'react';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneComponentProps, SceneObjectState } from './types';

export interface SceneCanvasTextState extends SceneObjectState {
  text: string;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
}

export class SceneCanvasText extends SceneObjectBase<SceneCanvasTextState> {
  EditableComponent = ({ model }: SceneComponentProps<SceneCanvasText>) => {
    const { text, fontSize = 20, align = 'left' } = model.useState();

    const style: CSSProperties = {
      fontSize: fontSize,
      display: 'flex',
      alignItems: 'center',
      padding: 16,
      justifyContent: align,
    };

    return <div style={style}>{text}</div>;
  };
}
