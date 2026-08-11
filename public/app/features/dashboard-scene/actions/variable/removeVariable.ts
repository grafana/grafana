import { restoreUnshadowedPredefinedVariables } from '../../settings/variables/utils';
import { removeElement } from '../element/removeElement';
import { type RemoveVariableActionHelperProps } from '../utils/types';

export function removeVariable({ source, removedObject }: RemoveVariableActionHelperProps) {
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
}
