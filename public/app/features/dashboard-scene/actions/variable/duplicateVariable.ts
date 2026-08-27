import { type SceneVariable, SceneVariableSet } from '@grafana/scenes';

import { DashboardInteractions } from '../../utils/interactions';
import { duplicateElement } from '../element/duplicateElement';

export function duplicateVariable(variable: SceneVariable) {
  const set = variable.parent;
  if (!(set instanceof SceneVariableSet)) {
    return;
  }

  const varsBefore = [...set.state.variables];

  duplicateElement({
    duplicatedObject: variable,
    source: set,
    cloneState: { name: `${variable.state.name}_copy${set.state.variables.length}` },
    perform: (copy) => set.setState({ variables: [...varsBefore, copy] }),
    undo: () => set.setState({ variables: varsBefore }),
  });

  DashboardInteractions.variableActionButtonClicked('duplicate', { type: variable.state.type });
}
