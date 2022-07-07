import React, { useEffect } from 'react';

import { SceneComponentEditingWrapper } from '../editor/SceneComponentEditWrapper';

import { SceneComponentProps, SceneObject } from './types';

export function SceneComponentWrapper<T extends SceneObject>({ model, isEditing }: SceneComponentProps<T>) {
  const Component = (model as any).constructor['Component'] ?? EmptyRenderer;
  const inner = <Component model={model} isEditing={isEditing} />;

  // Handle component activation state state
  useEffect(() => {
    if (!model.isActive) {
      model.activate();
    }
    return () => {
      if (model.isActive) {
        model.deactivate();
      }
    };
  }, [model]);

  if (!isEditing) {
    return inner;
  }

  return <SceneComponentEditingWrapper model={model}>{inner}</SceneComponentEditingWrapper>;
}

function EmptyRenderer<T>(_: SceneComponentProps<T>): React.ReactElement | null {
  return null;
}
