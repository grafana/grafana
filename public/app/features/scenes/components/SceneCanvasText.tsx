import React, { CSSProperties } from 'react';

import { Field, Input } from '@grafana/ui';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneLayoutChildState } from '../core/types';

export interface SceneCanvasTextState extends SceneLayoutChildState {
  text: string;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
}

export class SceneCanvasText extends SceneObjectBase<SceneCanvasTextState> {
  static Editor = Editor;
  static Component = ({ model }: SceneComponentProps<SceneCanvasText>) => {
    const { text, fontSize = 20, align = 'left' } = model.useState();

    const style: CSSProperties = {
      fontSize: fontSize,
      display: 'flex',
      flexGrow: 1,
      alignItems: 'center',
      padding: 16,
      justifyContent: align,
    };

    return <div style={style}>{text}</div>;
  };
}

function Editor({ model }: SceneComponentProps<SceneCanvasText>) {
  const { fontSize } = model.useState();

  return (
    <Field label="Font size">
      <Input
        type="number"
        defaultValue={fontSize}
        onBlur={(evt) => model.setState({ fontSize: parseInt(evt.currentTarget.value, 10) })}
      />
    </Field>
  );
}
