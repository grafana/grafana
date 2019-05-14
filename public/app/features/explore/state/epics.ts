import { Epic } from 'redux-observable';
import { webSocket } from 'rxjs/webSocket';
import { map, takeUntil, mergeMap, tap, filter } from 'rxjs/operators';

import { StoreState, ExploreId } from 'app/types';
import { ActionOf, ActionCreator, actionCreatorFactory } from '../../../core/redux/actionCreatorFactory';
import { config } from '../../../core/config';
import { updateDatasourceInstanceAction, resetExploreAction, changeRefreshIntervalAction } from './actionTypes';
import { EMPTY } from 'rxjs';
import { isLive } from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';
import { SeriesData } from '@grafana/ui/src/types/data';

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
}

export const startSubscriptionsAction = actionCreatorFactory<StartSubscriptionsPayload>(
  'explore/START_SUBSCRIPTIONS'
).create();

export interface StartSubscriptionPayload {
  url: string;
  refId: string;
  exploreId: ExploreId;
  dataReceivedActionCreator: ActionCreator<SubscriptionDataReceivedPayload>;
}

export const startSubscriptionAction = actionCreatorFactory<StartSubscriptionPayload>(
  'explore/START_SUBSCRIPTION'
).create();

export interface SubscriptionDataReceivedPayload {
  data: SeriesData;
  exploreId: ExploreId;
}

export const subscriptionDataReceivedAction = actionCreatorFactory<SubscriptionDataReceivedPayload>(
  'explore/SUBSCRIPTION_DATA_RECEIVED'
).create();

export const startSubscriptionsEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (action$, state$) => {
  return action$.ofType(startSubscriptionsAction.type).pipe(
    mergeMap((action: ActionOf<StartSubscriptionsPayload>) => {
      const { exploreId, dataReceivedActionCreator } = action.payload;
      const { datasourceInstance, queries, refreshInterval } = state$.value.explore[exploreId];

      if (!datasourceInstance || !datasourceInstance.convertToStreamTargets) {
        return EMPTY; //do nothing if datasource does not support streaming
      }

      if (!refreshInterval || !isLive(refreshInterval)) {
        return EMPTY; //do nothing if refresh interval is not 'LIVE'
      }

      const request: any = { targets: queries };
      return datasourceInstance.convertToStreamTargets(request).map(target =>
        startSubscriptionAction({
          url: convertToWebSocketUrl(target.url),
          refId: target.refId,
          exploreId,
          dataReceivedActionCreator,
        })
      );
    })
  );
};

export const startSubscriptionEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (action$, state$) => {
  return action$.ofType(startSubscriptionAction.type).pipe(
    mergeMap((action: ActionOf<StartSubscriptionPayload>) => {
      const { url, exploreId, refId, dataReceivedActionCreator } = action.payload;
      return webSocket(url).pipe(
        takeUntil(
          action$
            .ofType(
              startSubscriptionAction.type,
              resetExploreAction.type,
              updateDatasourceInstanceAction.type,
              changeRefreshIntervalAction.type
            )
            .pipe(
              filter(action => {
                if (action.type === resetExploreAction.type) {
                  return true; // stops all subscriptions if user navigates away
                }

                if (action.type === updateDatasourceInstanceAction.type && action.payload.exploreId === exploreId) {
                  return true; // stops subscriptions if user changes data source
                }

                if (action.type === changeRefreshIntervalAction.type && action.payload.exploreId === exploreId) {
                  return !isLive(action.payload.refreshInterval); // stops subscriptions if user changes refresh interval away from 'Live'
                }

                return action.payload.exploreId === exploreId && action.payload.refId === refId;
              }),
              tap(value => console.log('Stopping subscription', value))
            )
        ),
        map(result => {
          const { datasourceInstance } = state$.value.explore[exploreId];

          if (!datasourceInstance || !datasourceInstance.resultToSeriesData) {
            return null; //do nothing if datasource does not support streaming
          }

          const data = datasourceInstance.resultToSeriesData(result, refId);

          return dataReceivedActionCreator({ data, exploreId });
        }),
        filter(action => action !== null)
      );
    })
  );
};
