import { VariableType } from './variable';
import { StoreState } from '../../types';
import { VariableState } from './state/queryVariableReducer';
import { Observable, Subscriber } from 'rxjs';
import { store } from '../../store/store';
import { distinctUntilChanged } from 'rxjs/operators';

export const subscribeToVariableChanges = <State extends VariableState>(name: string, type: VariableType) => {
  const stateSelector = (state: StoreState): State => {
    const typeState = state.templating[type];
    const variableState = typeState.find(s => s.variable.name === name);
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
