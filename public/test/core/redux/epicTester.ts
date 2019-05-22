import { Epic, ActionsObservable, StateObservable } from 'redux-observable';
import { Subject } from 'rxjs';
import { WebSocketSubject } from 'rxjs/webSocket';

import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import { EpicDependencies } from 'app/store/configureStore';

export const epicTester = (
  epic: Epic<ActionOf<any>, ActionOf<any>, StoreState, EpicDependencies>,
  state?: StoreState
) => {
  const resultingActions: Array<ActionOf<any>> = [];
  const action$ = new Subject<ActionOf<any>>();
  const state$ = new Subject<StoreState>();
  const actionObservable$ = new ActionsObservable(action$);
  const stateObservable$ = new StateObservable(state$, state || ({} as StoreState));
  const websockets$: Array<Subject<any>> = [];
  const dependencies: EpicDependencies = {
    getWebSocket: () => {
      const webSocket$ = new Subject<any>();
      websockets$.push(webSocket$);
      return webSocket$ as WebSocketSubject<any>;
    },
  };
  epic(actionObservable$, stateObservable$, dependencies).subscribe({ next: action => resultingActions.push(action) });

  const whenActionIsDispatched = (action: ActionOf<any>) => {
    action$.next(action);

    return instance;
  };

  const whenWebSocketReceivesData = (data: any) => {
    websockets$.forEach(websocket$ => websocket$.next(data));

    return instance;
  };

  const thenResultingActionsEqual = (...actions: Array<ActionOf<any>>) => {
    expect(resultingActions).toEqual(actions);

    return instance;
  };

  const thenNoActionsWhereDispatched = () => {
    expect(resultingActions).toEqual([]);

    return instance;
  };

  const instance = {
    whenActionIsDispatched,
    whenWebSocketReceivesData,
    thenResultingActionsEqual,
    thenNoActionsWhereDispatched,
  };

  return instance;
};
