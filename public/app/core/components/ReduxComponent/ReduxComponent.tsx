import { PureComponent } from 'react';
import { Observable, Subscriber, Subscription } from 'rxjs';

import { store } from '../../../store/store';
import { StoreState } from '../../../types';
import { distinctUntilChanged } from 'rxjs/operators';
import { bindActionCreators } from 'redux';
import { isEqual } from 'lodash';

export interface ReduxComponentArguments<Props, ReduxState, ReduxActions> {
  props: Props;
  stateSelector: (state: StoreState) => ReduxState;
  actionsToDispatch: ReduxActions;
}

export class ReduxComponent<Props, State, ReduxState, ReduxActions> extends PureComponent<Props, State & ReduxState> {
  protected actions: { [P in keyof ReduxActions]?: ReduxActions[P] } = {};
  private readonly subscription: Subscription = null;
  constructor({ props, stateSelector, actionsToDispatch }: ReduxComponentArguments<Props, ReduxState, ReduxActions>) {
    super(props);

    this.subscription = new Observable((observer: Subscriber<ReduxState>) => {
      const unsubscribeFromStore = store.subscribe(() => observer.next(stateSelector(store.getState())));
      observer.next(stateSelector(store.getState()));
      return function unsubscribe() {
        unsubscribeFromStore();
      };
    })
      .pipe(
        distinctUntilChanged<ReduxState>((previous, current) => {
          const result = isEqual(previous, current);
          return result;
        })
      )
      .subscribe({
        next: state => {
          if (this.state) {
            this.setState(state);
            return;
          }

          this.state = state as State & ReduxState;
        },
      });

    Object.keys(actionsToDispatch).map(key => {
      // @ts-ignore
      this.actions[key] = bindActionCreators(actionsToDispatch[key], store.dispatch);
    });
  }

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
