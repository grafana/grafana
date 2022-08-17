import React from 'react';

import { Field, Input } from '@grafana/ui';

import { SceneObjectBase } from '../core/SceneObjectBase';
import {
  SceneComponentProps,
  SceneLayoutChild,
  SceneLayoutState,
  SceneObject,
  SceneWithActionState,
} from '../core/types';
import { isDataProviderNode, isTimeRangeNode } from './Scene';

export enum Orientation {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}

export interface SceneToolbarState extends SceneLayoutState {
  orientation: Orientation;
}

export class SceneToolboxLayout extends SceneObjectBase<SceneToolbarState> {
  static Component = ({ model, isEditing }: SceneComponentProps<SceneToolboxLayout>) => {
    const state = model.useState();
    const toolboxChildren = findToolboxEnabled(state.children);

    return (
      <div
        style={{
          flexGrow: 1,
          flexDirection: state.orientation === Orientation.Horizontal ? 'row' : 'column',
          display: 'flex',
          gap: '8px',
        }}
      >
        <div>
          {toolboxChildren.map((child) => {
            return <child.Component model={child} />;
          })}
        </div>
        <div
          className="toolbox-nodes"
          style={{
            display: 'flex',
            flexGrow: 1,
          }}
        >
          {renderNodes(state.children, Boolean(isEditing))}
        </div>
      </div>
    );
  };
}

function renderNodes(nodes?: SceneObject[], isEditing: boolean): React.ReactNode {
  if (!nodes) {
    return null;
  }

  return nodes.map((node) => {
    if (isToolboxEnabledSceneObject(node)) {
      return renderNodes(node.state.children, isEditing);
    }

    if (isDataProviderNode(node)) {
      return renderNodes(node.state.children, isEditing);
    }

    if (isTimeRangeNode(node)) {
      return (
        <>
          <node.Component model={node} />
          {renderNodes(node.state.children, isEditing)}
        </>
      );
    }

    return <node.Component model={node} isEditing={isEditing} />;
  });
}

function findToolboxEnabled(items: SceneLayoutChild[]) {
  let actions = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (isToolboxEnabledSceneObject(item)) {
      actions.push(item);
    }
  }

  return actions;
}

// function Editor({ model }: SceneComponentProps<SceneToolbar>) {
//   const { fontSize } = model.useState();

//   return (
//     <Field label="Font size">
//       <Input
//         type="number"
//         defaultValue={fontSize}
//         onBlur={(evt) => model.setState({ fontSize: parseInt(evt.currentTarget.value, 10) })}
//       />
//     </Field>
//   );
// }

function isToolboxEnabledSceneObject(item: SceneObject): item is SceneObject<SceneWithActionState> {
  return (item.state as SceneWithActionState).showInToolbox !== undefined;
}
