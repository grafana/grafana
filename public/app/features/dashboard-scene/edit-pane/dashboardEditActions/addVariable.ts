import { addElement } from './addElement';
import { type AddVariableActionHelperProps } from './types';

export function addVariable({ source, addedObject }: AddVariableActionHelperProps) {
  const varsBeforeAddition = [...(source.state.variables ?? [])];

  addElement({
    source,
    addedObject,
    perform() {
      source.setState({ variables: [...varsBeforeAddition, addedObject] });
    },
    undo() {
      source.setState({ variables: [...varsBeforeAddition] });
    },
  });
}
