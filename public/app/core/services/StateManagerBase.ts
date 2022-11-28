import { useEffect } from 'react';
import { Subject } from 'rxjs';

import { useForceUpdate } from '@grafana/ui';

export class StateManagerBase<TState> {
  subject = new Subject<TState>();
  state: TState;

  constructor(state: TState) {
    this.state = state;
    this.subject.next(state);
  }

  useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useLatestState(this);
  }

  setState(update: Partial<TState>) {
    this.state = {
      ...this.state,
      ...update,
    };
    this.subject.next(this.state);
  }
}
/**
 * This hook is always returning model.state instead of a useState that remembers the last state emitted on the subject
 * The reason for this is so that if the model instance change this function will always return the latest state.
 */
function useLatestState<TState>(model: StateManagerBase<TState>): TState {
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    const s = model.subject.subscribe(forceUpdate);
    return () => s.unsubscribe();
  }, [model, forceUpdate]);

  return model.state;
}
