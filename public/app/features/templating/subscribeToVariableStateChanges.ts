import { StoreState } from '../../types';
import { VariableState } from './state/queryVariableReducer';
import { Observable, Subscriber } from 'rxjs';
import { store } from '../../store/store';
import { distinctUntilChanged } from 'rxjs/operators';
import { VariableIdentifier } from './state/actions';

export const subscribeToVariableChanges = <State extends VariableState>(args: VariableIdentifier) => {
  const stateSelector = (state: StoreState): State => {
    const variableState = state.templating.variables.find(s => s.variable.uuid === args.uuid);
    return variableState as State;
  };

  return new Observable((observer: Subscriber<State>) => {
    const unsubscribeFromStore = store.subscribe(() => observer.next(stateSelector(store.getState())));
    observer.next(stateSelector(store.getState()));
    return function unsubscribe() {
      unsubscribeFromStore();
    };
  }).pipe(
    distinctUntilChanged<State>((previous, current) => {
      return previous === current;
    })
  );
};
