import { type SceneVariable, type SceneVariableSet } from '@grafana/scenes';

import { dropPredefinedVariableNamed } from '../../settings/variables/utils';
import { type DashboardActionTracking } from '../../sidebar/events';
import { isPredefinedOrigin } from '../../utils/predefinedVariables';
import { addElement } from '../element/addElement';

interface AddVariableActionHelperProps {
  tracking?: DashboardActionTracking;
  addedObject: SceneVariable;
  source: SceneVariableSet;
}

export function addVariable({ source, addedObject, tracking }: AddVariableActionHelperProps) {
  const varsBeforeAddition = [...(source.state.variables ?? [])];
  const name = addedObject.state.name;

  addElement({
    tracking: { actionId: 'variable.addVariable', trigger: tracking?.trigger },
    source,
    addedObject,
    perform() {
      // Stash then drop any predefined of the same name so the local wins live.
      dropPredefinedVariableNamed(source, name);
      const withoutShadowed = varsBeforeAddition.filter(
        (v) => !(v.state.name === name && isPredefinedOrigin(v.state.origin))
      );
      source.setState({ variables: [...withoutShadowed, addedObject] });
    },
    undo() {
      source.setState({ variables: [...varsBeforeAddition] });
    },
  });
}
