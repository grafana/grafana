import { isArray } from 'lodash';

import { variableRegex } from 'app/features/variables/utils';

import { SceneObject } from '../core/types';

import { SceneVariable } from './types';

export function sceneTemplateInterpolator(target: string, sceneObject: SceneObject) {
  // Skip any interpolation if there are no variables in the scene object graph
  if (!sceneObject.getVariables()) {
    return target;
  }

  variableRegex.lastIndex = 0;

  return target.replace(variableRegex, (match, var1, var2, fmt2, var3, fieldPath, fmt3) => {
    const variableName = var1 || var2 || var3;
    const variable = lookupSceneVariable(variableName, sceneObject);

    if (!variable) {
      return match;
    }

    const value = variable.getValue(fieldPath);

    if (isArray(value)) {
      return 'not supported yet';
    }

    return String(value);
  });
}

function lookupSceneVariable(name: string, sceneObject: SceneObject): SceneVariable | null | undefined {
  const variables = sceneObject.state.$variables;
  if (!variables) {
    if (sceneObject.parent) {
      return lookupSceneVariable(name, sceneObject.parent);
    } else {
      return null;
    }
  }

  const found = variables.getByName(name);
  if (found) {
    return found;
  } else if (sceneObject.parent) {
    return lookupSceneVariable(name, sceneObject.parent);
  }

  return null;
}
