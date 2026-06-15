import { t } from '@grafana/i18n';
import { type SceneVariable, SceneVariableSet } from '@grafana/scenes';

import { edit } from './edit';
import { type EditActionProps } from './types';

export function changeVariableHideValue({ source, oldValue, newValue }: EditActionProps<SceneVariable, 'hide'>) {
  const variableSet = source.parent;
  const variablesBeforeChange =
    variableSet instanceof SceneVariableSet ? [...(variableSet.state.variables ?? [])] : undefined;

  edit({
    description: t('dashboard.variable.hide.action', 'Change variable hide option'),
    source,
    perform: () => {
      source.setState({ hide: newValue });
      // Updating the variables set since components that show/hide variables subscribe to the variable set, not the individual variables.
      if (variableSet instanceof SceneVariableSet) {
        variableSet.setState({ variables: [...(variableSet.state.variables ?? [])] });
      }
    },
    undo: () => {
      source.setState({ hide: oldValue });
      if (variableSet instanceof SceneVariableSet && variablesBeforeChange) {
        variableSet.setState({ variables: variablesBeforeChange });
      }
    },
  });
}
