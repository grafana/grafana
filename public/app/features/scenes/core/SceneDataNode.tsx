import React from 'react';

import { renderNodes } from '../components/Scene';

import { SceneDataObject } from './SceneObjectBase';
import { SceneComponentProps, SceneDataState, SceneLayoutState, SceneObjectStatePlain } from './types';

export interface SceneDataNodeState extends SceneObjectStatePlain, SceneLayoutState, SceneDataState {}

export class SceneDataNode extends SceneDataObject<SceneDataNodeState> {
  static Component = SceneDataNodeRenderer;
}

function SceneDataNodeRenderer({ model, isEditing }: SceneComponentProps<SceneDataNode>) {
  return <>{renderNodes(model.state.children, Boolean(isEditing))}</>;
}
