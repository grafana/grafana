import React, { useEffect } from 'react';

import { SceneComponentProps, SceneEditor, SceneObject } from './types';

export function SceneComponentWrapper<T extends SceneObject>({
  model,
  isEditing,
  ...otherProps
}: SceneComponentProps<T>) {
  const Component = (model as any).constructor['Component'] ?? EmptyRenderer;
  const inner = <Component {...otherProps} model={model} isEditing={isEditing} />;

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

  /** Useful for tests and evaluating efficiency in reducing renderings */
  // @ts-ignore
  model._renderCount += 1;

  if (!isEditing) {
    return inner;
  }

  const editor = getSceneEditor(model);
  const EditWrapper = getSceneEditor(model).getEditComponentWrapper();

  return (
    <EditWrapper model={model} editor={editor}>
      {inner}
    </EditWrapper>
  );
}

function EmptyRenderer<T>(_: SceneComponentProps<T>): React.ReactElement | null {
  return null;
}

function getSceneEditor(sceneObject: SceneObject): SceneEditor {
  const { $editor } = sceneObject.state;
  if ($editor) {
    return $editor;
  }

  if (sceneObject.parent) {
    return getSceneEditor(sceneObject.parent);
  }

  throw new Error('No editor found in scene tree');
}
