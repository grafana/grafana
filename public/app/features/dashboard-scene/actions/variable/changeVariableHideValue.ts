import { t } from '@grafana/i18n';
import { type SceneVariable, SceneVariableSet } from '@grafana/scenes';

import { type DashboardActionTracking } from '../../sidebar/events';
import { edit } from '../utils/edit';

interface ChangeVariableHideValueActionProps {
  tracking?: DashboardActionTracking;
  source: SceneVariable;
  oldValue: SceneVariable['state']['hide'];
  newValue: SceneVariable['state']['hide'];
}

export function changeVariableHideValue({ tracking, source, oldValue, newValue }: ChangeVariableHideValueActionProps) {
  const variableSet = source.parent;
  const variablesBeforeChange =
    variableSet instanceof SceneVariableSet ? [...(variableSet.state.variables ?? [])] : undefined;

  edit({
    tracking: { actionId: 'variable.changeVariableHideValue', trigger: tracking?.trigger },
    description: t('dashboard.edit-actions.variable-hide', 'Change variable hide option'),
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
