import { t } from '@grafana/i18n';
import { type SceneVariable, type SceneVariableSet } from '@grafana/scenes';

import { edit } from '../utils/edit';

interface ChangeVariableTypeActionHelperProps {
  oldVariable: SceneVariable;
  newVariable: SceneVariable;
  source: SceneVariableSet;
}

export function changeVariableType({ source, oldVariable, newVariable }: ChangeVariableTypeActionHelperProps) {
  const varsBeforeChange = [...source.state.variables];
  const variableIndex = varsBeforeChange.indexOf(oldVariable);

  if (variableIndex === -1) {
    throw new Error('Variable not found in source set');
  }

  const varsAfterChange = [...varsBeforeChange];
  varsAfterChange[variableIndex] = newVariable;

  edit({
    description: t('dashboard.edit-actions.variable-type', 'Change variable type'),
    source,
    addedObject: newVariable,
    removedObject: oldVariable,
    perform() {
      source.setState({ variables: varsAfterChange });
    },
    undo() {
      source.setState({ variables: varsBeforeChange });
    },
  });
}
