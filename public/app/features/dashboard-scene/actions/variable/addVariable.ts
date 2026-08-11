import { dropPredefinedVariableNamed } from '../../settings/variables/utils';
import { isPredefinedOrigin } from '../../utils/predefinedVariables';
import { addElement } from '../element/addElement';
import { type AddVariableActionHelperProps } from '../utils/types';

export function addVariable({ source, addedObject }: AddVariableActionHelperProps) {
  const varsBeforeAddition = [...(source.state.variables ?? [])];
  const name = addedObject.state.name;

  addElement({
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
