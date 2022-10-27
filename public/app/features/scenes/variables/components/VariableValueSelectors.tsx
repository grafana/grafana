import React from 'react';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneComponentProps, SceneObject, SceneObjectStatePlain } from '../../core/types';
import { SceneVariables } from '../types';

export class VariableValueSelectors extends SceneObjectBase<SceneObjectStatePlain> {
  static Component = VariableValueSelectorsRenderer;
}

function VariableValueSelectorsRenderer({ model }: SceneComponentProps<VariableValueSelectors>) {
  const variables = getVariables(model).useState();

  return (
    <>
      {variables.variables.map(
        (child) => child.ValueSelectComponent && <child.ValueSelectComponent key={child.state.key} model={child} />
      )}
    </>
  );
}

function getVariables(model: SceneObject): SceneVariables {
  if (model.state.$variables) {
    return model.state.$variables;
  }

  if (model.parent) {
    return getVariables(model.parent);
  }

  throw new Error('No variables found');
}
