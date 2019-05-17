import { liveOption } from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';
import { DataSourceApi, DataQuery } from '@grafana/ui/src/types/datasource';

import { ExploreId, ExploreState } from 'app/types';
import { actionCreatorFactory } from 'app/core/redux/actionCreatorFactory';
import {
  startSubscriptionsEpic,
  startSubscriptionsAction,
  SubscriptionDataReceivedPayload,
  startSubscriptionAction,
  startSubscriptionEpic,
  limitMessageRatePayloadAction,
} from './epics';
import { makeExploreItemState } from './reducers';
import { epicTester } from 'test/core/redux/epicTester';
import {
  resetExploreAction,
  updateDatasourceInstanceAction,
  changeRefreshIntervalAction,
  clearQueriesAction,
} from './actionTypes';

const setup = (options: any = {}) => {
  const url = '/api/datasources/proxy/20/api/prom/tail?query=%7Bfilename%3D%22%2Fvar%2Flog%2Fdocker.log%22%7D';
  const webSocketUrl = 'ws://localhost' + url;
  const refId = options.refId || 'A';
  const exploreId = ExploreId.left;
  const datasourceInstance: DataSourceApi = options.datasourceInstance || {
    id: 1337,
    query: jest.fn(),
    name: 'test',
    testDatasource: jest.fn(),
    convertToStreamTargets: () => [
      {
        url,
        refId,
      },
    ],
    resultToSeriesData: data => [data],
  };
  const itemState = makeExploreItemState();
  const explore: Partial<ExploreState> = {
    [exploreId]: {
      ...itemState,
      datasourceInstance,
      refreshInterval: options.refreshInterval || liveOption.value,
      queries: [{} as DataQuery],
    },
  };
  const state: any = {
    explore,
  };

  return { url, state, refId, webSocketUrl, exploreId };
};

const dataReceivedActionCreator = actionCreatorFactory<SubscriptionDataReceivedPayload>('test').create();

describe('startSubscriptionsEpic', () => {
  describe('when startSubscriptionsAction is dispatched', () => {
    describe('and datasource supports convertToStreamTargets', () => {
      describe('and explore is Live', () => {
        it('then correct actions should be dispatched', () => {
          const { state, refId, webSocketUrl, exploreId } = setup();

          epicTester(startSubscriptionsEpic, state)
            .whenActionIsDispatched(startSubscriptionsAction({ exploreId, dataReceivedActionCreator }))
            .thenResultingActionsEqual(
              startSubscriptionAction({
                exploreId,
                refId,
                url: webSocketUrl,
                dataReceivedActionCreator,
              })
            );
        });
      });

      describe('and explore is not Live', () => {
        it('then no actions should be dispatched', () => {
          const { state, exploreId } = setup({ refreshInterval: '10s' });

          epicTester(startSubscriptionsEpic, state)
            .whenActionIsDispatched(startSubscriptionsAction({ exploreId, dataReceivedActionCreator }))
            .thenNoActionsWhereDispatched();
        });
      });
    });

    describe('and datasource does not support streaming', () => {
      it('then no actions should be dispatched', () => {
        const { state, exploreId } = setup({ datasourceInstance: {} });

        epicTester(startSubscriptionsEpic, state)
          .whenActionIsDispatched(startSubscriptionsAction({ exploreId, dataReceivedActionCreator }))
          .thenNoActionsWhereDispatched();
      });
    });
  });
});

describe('startSubscriptionEpic', () => {
  describe('when startSubscriptionAction is dispatched', () => {
    describe('and datasource supports resultToSeriesData', () => {
      it('then correct actions should be dispatched', () => {
        const { state, webSocketUrl, refId, exploreId } = setup();

        epicTester(startSubscriptionEpic, state)
          .whenActionIsDispatched(
            startSubscriptionAction({ url: webSocketUrl, refId, exploreId, dataReceivedActionCreator })
          )
          .thenNoActionsWhereDispatched()
          .whenWebSocketReceivesData({ data: [1, 2, 3] })
          .thenResultingActionsEqual(
            limitMessageRatePayloadAction({
              exploreId,
              data: { data: [1, 2, 3] } as any,
              dataReceivedActionCreator,
            })
          )
          .whenWebSocketReceivesData({ data: [4, 5, 6] })
          .thenResultingActionsEqual(
            limitMessageRatePayloadAction({
              exploreId,
              data: { data: [1, 2, 3] } as any,
              dataReceivedActionCreator,
            }),
            limitMessageRatePayloadAction({
              exploreId,
              data: { data: [4, 5, 6] } as any,
              dataReceivedActionCreator,
            })
          );
      });
    });

    describe('and datasource does not support resultToSeriesData', () => {
      it('then no actions should be dispatched', () => {
        const { state, webSocketUrl, refId, exploreId } = setup({ datasourceInstance: {} });

        epicTester(startSubscriptionEpic, state)
          .whenActionIsDispatched(
            startSubscriptionAction({ url: webSocketUrl, refId, exploreId, dataReceivedActionCreator })
          )
          .thenNoActionsWhereDispatched()
          .whenWebSocketReceivesData({ data: [1, 2, 3] })
          .thenNoActionsWhereDispatched();
      });
    });
  });

  describe('when an subscription is active', () => {
    describe('and resetExploreAction is dispatched', () => {
      it('then subscription should be unsubscribed', () => {
        const { state, webSocketUrl, refId, exploreId } = setup();

        epicTester(startSubscriptionEpic, state)
          .whenActionIsDispatched(
            startSubscriptionAction({ url: webSocketUrl, refId, exploreId, dataReceivedActionCreator })
          )
          .thenNoActionsWhereDispatched()
          .whenWebSocketReceivesData({ data: [1, 2, 3] })
          .thenResultingActionsEqual(
            limitMessageRatePayloadAction({
              exploreId,
              data: { data: [1, 2, 3] } as any,
              dataReceivedActionCreator,
            })
          )
          .whenActionIsDispatched(resetExploreAction())
          .whenWebSocketReceivesData({ data: [4, 5, 6] })
          .thenResultingActionsEqual(
            limitMessageRatePayloadAction({
              exploreId,
              data: { data: [1, 2, 3] } as any,
              dataReceivedActionCreator,
            })
          );
      });
    });

    describe('and updateDatasourceInstanceAction is dispatched', () => {
      describe('and exploreId matches the websockets', () => {
        it('then subscription should be unsubscribed', () => {
          const { state, webSocketUrl, refId, exploreId } = setup();

          epicTester(startSubscriptionEpic, state)
            .whenActionIsDispatched(
              startSubscriptionAction({
                url: webSocketUrl,
                refId,
                exploreId,
                dataReceivedActionCreator,
              })
            )
            .thenNoActionsWhereDispatched()
            .whenWebSocketReceivesData({ data: [1, 2, 3] })
            .thenResultingActionsEqual(
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [1, 2, 3] } as any,
                dataReceivedActionCreator,
              })
            )
            .whenActionIsDispatched(updateDatasourceInstanceAction({ exploreId, datasourceInstance: null }))
            .whenWebSocketReceivesData({ data: [4, 5, 6] })
            .thenResultingActionsEqual(
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [1, 2, 3] } as any,
                dataReceivedActionCreator,
              })
            );
        });
      });

      describe('and exploreId does not match the websockets', () => {
        it('then subscription should not be unsubscribed', () => {
          const { state, webSocketUrl, refId, exploreId } = setup();

          epicTester(startSubscriptionEpic, state)
            .whenActionIsDispatched(
              startSubscriptionAction({
                url: webSocketUrl,
                refId,
                exploreId,
                dataReceivedActionCreator,
              })
            )
            .thenNoActionsWhereDispatched()
            .whenWebSocketReceivesData({ data: [1, 2, 3] })
            .thenResultingActionsEqual(
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [1, 2, 3] } as any,
                dataReceivedActionCreator,
              })
            )
            .whenActionIsDispatched(
              updateDatasourceInstanceAction({ exploreId: ExploreId.right, datasourceInstance: null })
            )
            .whenWebSocketReceivesData({ data: [4, 5, 6] })
            .thenResultingActionsEqual(
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [1, 2, 3] } as any,
                dataReceivedActionCreator,
              }),
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [4, 5, 6] } as any,
                dataReceivedActionCreator,
              })
            );
        });
      });
    });

    describe('and changeRefreshIntervalAction is dispatched', () => {
      describe('and exploreId matches the websockets', () => {
        describe('and refreshinterval is not "Live"', () => {
          it('then subscription should be unsubscribed', () => {
            const { state, webSocketUrl, refId, exploreId } = setup();

            epicTester(startSubscriptionEpic, state)
              .whenActionIsDispatched(
                startSubscriptionAction({
                  url: webSocketUrl,
                  refId,
                  exploreId,
                  dataReceivedActionCreator,
                })
              )
              .thenNoActionsWhereDispatched()
              .whenWebSocketReceivesData({ data: [1, 2, 3] })
              .thenResultingActionsEqual(
                limitMessageRatePayloadAction({
                  exploreId,
                  data: { data: [1, 2, 3] } as any,
                  dataReceivedActionCreator,
                })
              )
              .whenActionIsDispatched(changeRefreshIntervalAction({ exploreId, refreshInterval: '10s' }))
              .whenWebSocketReceivesData({ data: [4, 5, 6] })
              .thenResultingActionsEqual(
                limitMessageRatePayloadAction({
                  exploreId,
                  data: { data: [1, 2, 3] } as any,
                  dataReceivedActionCreator,
                })
              );
          });
        });

        describe('and refreshinterval is "Live"', () => {
          it('then subscription should not be unsubscribed', () => {
            const { state, webSocketUrl, refId, exploreId } = setup();

            epicTester(startSubscriptionEpic, state)
              .whenActionIsDispatched(
                startSubscriptionAction({
                  url: webSocketUrl,
                  refId,
                  exploreId,
                  dataReceivedActionCreator,
                })
              )
              .thenNoActionsWhereDispatched()
              .whenWebSocketReceivesData({ data: [1, 2, 3] })
              .thenResultingActionsEqual(
                limitMessageRatePayloadAction({
                  exploreId,
                  data: { data: [1, 2, 3] } as any,
                  dataReceivedActionCreator,
                })
              )
              .whenActionIsDispatched(changeRefreshIntervalAction({ exploreId, refreshInterval: liveOption.value }))
              .whenWebSocketReceivesData({ data: [4, 5, 6] })
              .thenResultingActionsEqual(
                limitMessageRatePayloadAction({
                  exploreId,
                  data: { data: [1, 2, 3] } as any,
                  dataReceivedActionCreator,
                }),
                limitMessageRatePayloadAction({
                  exploreId,
                  data: { data: [4, 5, 6] } as any,
                  dataReceivedActionCreator,
                })
              );
          });
        });
      });

      describe('and exploreId does not match the websockets', () => {
        it('then subscription should not be unsubscribed', () => {
          const { state, webSocketUrl, refId, exploreId } = setup();

          epicTester(startSubscriptionEpic, state)
            .whenActionIsDispatched(
              startSubscriptionAction({
                url: webSocketUrl,
                refId,
                exploreId,
                dataReceivedActionCreator,
              })
            )
            .thenNoActionsWhereDispatched()
            .whenWebSocketReceivesData({ data: [1, 2, 3] })
            .thenResultingActionsEqual(
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [1, 2, 3] } as any,
                dataReceivedActionCreator,
              })
            )
            .whenActionIsDispatched(changeRefreshIntervalAction({ exploreId: ExploreId.right, refreshInterval: '10s' }))
            .whenWebSocketReceivesData({ data: [4, 5, 6] })
            .thenResultingActionsEqual(
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [1, 2, 3] } as any,
                dataReceivedActionCreator,
              }),
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [4, 5, 6] } as any,
                dataReceivedActionCreator,
              })
            );
        });
      });
    });

    describe('and clearQueriesAction is dispatched', () => {
      describe('and exploreId matches the websockets', () => {
        it('then subscription should be unsubscribed', () => {
          const { state, webSocketUrl, refId, exploreId } = setup();

          epicTester(startSubscriptionEpic, state)
            .whenActionIsDispatched(
              startSubscriptionAction({
                url: webSocketUrl,
                refId,
                exploreId,
                dataReceivedActionCreator,
              })
            )
            .thenNoActionsWhereDispatched()
            .whenWebSocketReceivesData({ data: [1, 2, 3] })
            .thenResultingActionsEqual(
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [1, 2, 3] } as any,
                dataReceivedActionCreator,
              })
            )
            .whenActionIsDispatched(clearQueriesAction({ exploreId }))
            .whenWebSocketReceivesData({ data: [4, 5, 6] })
            .thenResultingActionsEqual(
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [1, 2, 3] } as any,
                dataReceivedActionCreator,
              })
            );
        });
      });

      describe('and exploreId does not match the websockets', () => {
        it('then subscription should not be unsubscribed', () => {
          const { state, webSocketUrl, refId, exploreId } = setup();

          epicTester(startSubscriptionEpic, state)
            .whenActionIsDispatched(
              startSubscriptionAction({
                url: webSocketUrl,
                refId,
                exploreId,
                dataReceivedActionCreator,
              })
            )
            .thenNoActionsWhereDispatched()
            .whenWebSocketReceivesData({ data: [1, 2, 3] })
            .thenResultingActionsEqual(
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [1, 2, 3] } as any,
                dataReceivedActionCreator,
              })
            )
            .whenActionIsDispatched(clearQueriesAction({ exploreId: ExploreId.right }))
            .whenWebSocketReceivesData({ data: [4, 5, 6] })
            .thenResultingActionsEqual(
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [1, 2, 3] } as any,
                dataReceivedActionCreator,
              }),
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [4, 5, 6] } as any,
                dataReceivedActionCreator,
              })
            );
        });
      });
    });

    describe('and startSubscriptionAction is dispatched', () => {
      describe('and exploreId and refId matches the websockets', () => {
        it('then subscription should be unsubscribed', () => {
          const { state, webSocketUrl, refId, exploreId } = setup();

          epicTester(startSubscriptionEpic, state)
            .whenActionIsDispatched(
              startSubscriptionAction({
                url: webSocketUrl,
                refId,
                exploreId,
                dataReceivedActionCreator,
              })
            )
            .thenNoActionsWhereDispatched()
            .whenWebSocketReceivesData({ data: [1, 2, 3] })
            .thenResultingActionsEqual(
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [1, 2, 3] } as any,
                dataReceivedActionCreator,
              })
            )
            .whenActionIsDispatched(
              startSubscriptionAction({
                url: webSocketUrl,
                refId,
                exploreId,
                dataReceivedActionCreator,
              })
            )
            .whenWebSocketReceivesData({ data: [4, 5, 6] })
            .thenResultingActionsEqual(
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [1, 2, 3] } as any,
                dataReceivedActionCreator,
              }),
              limitMessageRatePayloadAction({
                exploreId,
                data: { data: [4, 5, 6] } as any,
                dataReceivedActionCreator,
              })
              // This looks like we haven't stopped the subscription but we actually started the same again
            );
        });

        describe('and exploreId or refId does not match the websockets', () => {
          it('then subscription should not be unsubscribed and another websocket is started', () => {
            const { state, webSocketUrl, refId, exploreId } = setup();

            epicTester(startSubscriptionEpic, state)
              .whenActionIsDispatched(
                startSubscriptionAction({
                  url: webSocketUrl,
                  refId,
                  exploreId,
                  dataReceivedActionCreator,
                })
              )
              .thenNoActionsWhereDispatched()
              .whenWebSocketReceivesData({ data: [1, 2, 3] })
              .thenResultingActionsEqual(
                limitMessageRatePayloadAction({
                  exploreId,
                  data: { data: [1, 2, 3] } as any,
                  dataReceivedActionCreator,
                })
              )
              .whenActionIsDispatched(
                startSubscriptionAction({
                  url: webSocketUrl,
                  refId: 'B',
                  exploreId,
                  dataReceivedActionCreator,
                })
              )
              .whenWebSocketReceivesData({ data: [4, 5, 6] })
              .thenResultingActionsEqual(
                limitMessageRatePayloadAction({
                  exploreId,
                  data: { data: [1, 2, 3] } as any,
                  dataReceivedActionCreator,
                }),
                limitMessageRatePayloadAction({
                  exploreId,
                  data: { data: [4, 5, 6] } as any,
                  dataReceivedActionCreator,
                }),
                limitMessageRatePayloadAction({
                  exploreId,
                  data: { data: [4, 5, 6] } as any,
                  dataReceivedActionCreator,
                })
              );
          });
        });
      });
    });
  });
});
