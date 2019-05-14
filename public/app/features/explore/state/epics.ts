import { Epic } from 'redux-observable';
import { webSocket } from 'rxjs/webSocket';
import { map, takeUntil, mergeMap, tap, filter } from 'rxjs/operators';

import { StoreState, ExploreId } from 'app/types';
import { ActionOf, ActionCreator, actionCreatorFactory } from '../../../core/redux/actionCreatorFactory';
import { config } from '../../../core/config';
import { updateDatasourceInstanceAction, resetExploreAction } from './actionTypes';
import { EMPTY } from 'rxjs';

const convertToWebSocketUrl = (url: string) => {
  const protocol = window.location.protocol === 'https' ? 'wss://' : 'ws://';
  let backend = `${protocol}${window.location.host}${config.appSubUrl}`;
  if (backend.endsWith('/')) {
    backend = backend.slice(0, backend.length - 1);
  }
  return `${backend}${url}`;
};

export interface StartSubscriptionsPayload {
  exploreId: ExploreId;
  dataReceivedActionCreator: ActionCreator<SubscriptionDataReceivedPayload>;
  stopsActionCreator: ActionCreator<StopSubscriptionPayload>;
  pauseActionCreator?: ActionCreator<PauseSubscriptionPayload>;
  playActionCreator?: ActionCreator<PauseSubscriptionPayload>;
}

export const startSubscriptionsAction = actionCreatorFactory<StartSubscriptionsPayload>(
  'explore/START_SUBSCRIPTIONS'
).create();

export interface StartSubscriptionPayload {
  url: string;
  refId: string;
  exploreId: ExploreId;
  dataReceivedActionCreator: ActionCreator<SubscriptionDataReceivedPayload>;
  stopsActionCreator: ActionCreator<StopSubscriptionPayload>;
  pauseActionCreator?: ActionCreator<PauseSubscriptionPayload>;
  playActionCreator?: ActionCreator<PauseSubscriptionPayload>;
}

export const startSubscriptionAction = actionCreatorFactory<StartSubscriptionPayload>(
  'explore/START_SUBSCRIPTION'
).create();

export interface StopSubscriptionPayload {
  refId: string;
  exploreId: ExploreId;
}

export const stopSubscriptionAction = actionCreatorFactory<StopSubscriptionPayload>(
  'explore/STOP_SUBSCRIPTION'
).create();

export interface PauseSubscriptionPayload extends StopSubscriptionPayload {}
export interface PlaySubscriptionPayload extends StopSubscriptionPayload {}

export interface SubscriptionDataReceivedPayload {
  data: any;
  exploreId: ExploreId;
}

export const subscriptionDataReceivedAction = actionCreatorFactory<SubscriptionDataReceivedPayload>(
  'explore/SUBSCRIPTION_DATA_RECEIVED'
).create();

export const startSubscriptionsEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (action$, state$) => {
  return action$.ofType(startSubscriptionsAction.type).pipe(
    mergeMap((action: ActionOf<StartSubscriptionsPayload>) => {
      const {
        exploreId,
        dataReceivedActionCreator,
        stopsActionCreator,
        pauseActionCreator,
        playActionCreator,
      } = action.payload;
      const { datasourceInstance, queries } = state$.value.explore[exploreId];

      if (!datasourceInstance || !datasourceInstance.convertToStreamTargets) {
        return EMPTY;
      }

      const request: any = { targets: queries };
      return datasourceInstance.convertToStreamTargets(request).map(target =>
        startSubscriptionAction({
          url: convertToWebSocketUrl(target.url),
          refId: target.refId,
          exploreId,
          dataReceivedActionCreator,
          stopsActionCreator,
          pauseActionCreator,
          playActionCreator,
        })
      );
    })
  );
};

export const startSubscriptionEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = action$ => {
  return action$.ofType(startSubscriptionAction.type).pipe(
    mergeMap((action: ActionOf<StartSubscriptionPayload>) => {
      const { url, exploreId, refId, dataReceivedActionCreator, stopsActionCreator } = action.payload;
      return webSocket(url).pipe(
        takeUntil(
          action$
            .ofType(
              startSubscriptionAction.type,
              stopsActionCreator.type,
              resetExploreAction.type,
              updateDatasourceInstanceAction.type
            )
            .pipe(
              filter(action => {
                if (action.type === resetExploreAction.type || action.type === updateDatasourceInstanceAction.type) {
                  return true; // stops all subscriptions if user navigates away from explore or changes data source
                }

                return action.payload.exploreId === exploreId && action.payload.refId === refId;
              }),
              tap(value => console.log('Stopping subscription', value))
            )
        ),
        map(data => {
          return dataReceivedActionCreator({ data, exploreId });
        })
      );
    })
  );
};
