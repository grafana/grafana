import { removeElement } from './removeElement';
import { type RemoveVariableActionHelperProps } from './types';

export function removeVariable({ source, removedObject }: RemoveVariableActionHelperProps) {
  const varsBeforeRemoval = [...source.state.variables];

  removeElement({
    source,
    removedObject,
    perform() {
      source.setState({ variables: varsBeforeRemoval.filter((v) => v !== removedObject) });
    },
    undo() {
      source.setState({ variables: varsBeforeRemoval });
    },
  });
}
