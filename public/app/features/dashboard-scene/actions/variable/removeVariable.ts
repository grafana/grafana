import { type SceneVariable, type SceneVariableSet } from '@grafana/scenes';

import { restoreUnshadowedPredefinedVariables } from '../../settings/variables/utils';
import { DashboardInteractions } from '../../utils/interactions';
import { removeElement } from '../element/removeElement';

import { refuseVariableWhilePlanning } from './refuseVariableWhilePlanning';

interface RemoveVariableActionHelperProps {
  removedObject: SceneVariable;
  source: SceneVariableSet;
}

export function removeVariable({ source, removedObject }: RemoveVariableActionHelperProps) {
  if (refuseVariableWhilePlanning(source, 'remove-variable')) {
    return;
  }

  const varsBeforeRemoval = [...source.state.variables];

  removeElement({
    source,
    removedObject,
    perform() {
      source.setState({ variables: varsBeforeRemoval.filter((v) => v !== removedObject) });
      // Local no longer shadows — re-inject any stashed predefined of the freed name.
      restoreUnshadowedPredefinedVariables(source);
    },
    undo() {
      source.setState({ variables: [...varsBeforeRemoval] });
    },
  });

  DashboardInteractions.variableActionButtonClicked('delete', { type: removedObject.state.type });
}
