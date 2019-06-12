import { mockExploreState } from 'test/mocks/mockExploreState';
import { epicTester } from 'test/core/redux/epicTester';
import { runQueriesBatchEpic } from './runQueriesBatchEpic';
import {
  runQueriesBatchAction,
  queryStartAction,
  historyUpdatedAction,
  processQueryResultsAction,
  processQueryErrorsAction,
  limitMessageRatePayloadAction,
  resetExploreAction,
  updateDatasourceInstanceAction,
  changeRefreshIntervalAction,
  clearQueriesAction,
  stateSaveAction,
} from '../actionTypes';
import { LoadingState, DataQueryRequest, SeriesData, FieldType } from '@grafana/ui';

const testContext = () => {
  const series: SeriesData[] = [
    {
      fields: [
        {
          name: 'Value',
        },
        {
          name: 'Time',
          type: FieldType.time,
          unit: 'dateTimeAsIso',
        },
      ],
      rows: [],
      refId: 'A',
    },
  ];
  const response = { data: series };

  return {
    response,
    series,
  };
};

describe('runQueriesBatchEpic', () => {
  let originalDateNow = Date.now;
  beforeEach(() => {
    originalDateNow = Date.now;
    Date.now = () => 1337;
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('when runQueriesBatchAction is dispatched', () => {
    describe('and query targets are not live', () => {
      describe('and query is successful', () => {
        it('then correct actions are dispatched', () => {
          const { response, series } = testContext();
          const { exploreId, state, history, datasourceId } = mockExploreState();

          epicTester(runQueriesBatchEpic, state)
            .whenActionIsDispatched(
              runQueriesBatchAction({ exploreId, queryOptions: { live: false, interval: '', maxDataPoints: 1980 } })
            )
            .whenQueryReceivesResponse(response)
            .thenResultingActionsEqual(
              queryStartAction({ exploreId }),
              historyUpdatedAction({ exploreId, history }),
              processQueryResultsAction({
                exploreId,
                delta: null,
                series,
                latency: 0,
                datasourceId,
                loadingState: LoadingState.Done,
              }),
              stateSaveAction()
            );
        });
      });

      describe('and query is not successful', () => {
        it('then correct actions are dispatched', () => {
          const error = {
            message: 'Error parsing line x',
          };
          const { exploreId, state, datasourceId } = mockExploreState();

          epicTester(runQueriesBatchEpic, state)
            .whenActionIsDispatched(
              runQueriesBatchAction({ exploreId, queryOptions: { live: false, interval: '', maxDataPoints: 1980 } })
            )
            .whenQueryThrowsError(error)
            .thenResultingActionsEqual(
              queryStartAction({ exploreId }),
              processQueryErrorsAction({ exploreId, response: error, datasourceId })
            );
        });
      });
    });

    describe('and query targets are live', () => {
      describe('and state equals Streaming', () => {
        it('then correct actions are dispatched', () => {
          const { exploreId, state, datasourceId } = mockExploreState();
          const unsubscribe = jest.fn();
          const serieA = {
            fields: [],
            rows: [],
            refId: 'A',
          };
          const serieB = {
            fields: [],
            rows: [],
            refId: 'B',
          };

          epicTester(runQueriesBatchEpic, state)
            .whenActionIsDispatched(
              runQueriesBatchAction({ exploreId, queryOptions: { live: true, interval: '', maxDataPoints: 1980 } })
            )
            .whenQueryObserverReceivesEvent({
              state: LoadingState.Streaming,
              delta: [serieA],
              key: 'some key',
              request: {} as DataQueryRequest,
              unsubscribe,
            })
            .whenQueryObserverReceivesEvent({
              state: LoadingState.Streaming,
              delta: [serieB],
              key: 'some key',
              request: {} as DataQueryRequest,
              unsubscribe,
            })
            .thenResultingActionsEqual(
              queryStartAction({ exploreId }),
              limitMessageRatePayloadAction({ exploreId, series: [serieA], datasourceId }),
              limitMessageRatePayloadAction({ exploreId, series: [serieB], datasourceId })
            );
        });
      });

      describe('and state equals Error', () => {
        it('then correct actions are dispatched', () => {
          const { exploreId, state, datasourceId } = mockExploreState();
          const unsubscribe = jest.fn();
          const error = { message: 'Something went really wrong!' };

          epicTester(runQueriesBatchEpic, state)
            .whenActionIsDispatched(
              runQueriesBatchAction({ exploreId, queryOptions: { live: true, interval: '', maxDataPoints: 1980 } })
            )
            .whenQueryObserverReceivesEvent({
              state: LoadingState.Error,
              error,
              key: 'some key',
              request: {} as DataQueryRequest,
              unsubscribe,
            })
            .thenResultingActionsEqual(
              queryStartAction({ exploreId }),
              processQueryErrorsAction({ exploreId, response: error, datasourceId })
            );
        });
      });

      describe('and state equals Done', () => {
        it('then correct actions are dispatched', () => {
          const { exploreId, state, datasourceId, history } = mockExploreState();
          const unsubscribe = jest.fn();
          const serieA = {
            fields: [],
            rows: [],
            refId: 'A',
          };
          const serieB = {
            fields: [],
            rows: [],
            refId: 'B',
          };
          const delta = [serieA, serieB];

          epicTester(runQueriesBatchEpic, state)
            .whenActionIsDispatched(
              runQueriesBatchAction({ exploreId, queryOptions: { live: true, interval: '', maxDataPoints: 1980 } })
            )
            .whenQueryObserverReceivesEvent({
              state: LoadingState.Done,
              series: null,
              delta,
              key: 'some key',
              request: {} as DataQueryRequest,
              unsubscribe,
            })
            .thenResultingActionsEqual(
              queryStartAction({ exploreId }),
              historyUpdatedAction({ exploreId, history }),
              processQueryResultsAction({
                exploreId,
                delta,
                series: null,
                latency: 0,
                datasourceId,
                loadingState: LoadingState.Done,
              }),
              stateSaveAction()
            );
        });
      });
    });

    describe('and another runQueriesBatchAction is dispatched', () => {
      it('then the observable should be unsubscribed', () => {
        const { response, series } = testContext();
        const { exploreId, state, history, datasourceId } = mockExploreState();
        const unsubscribe = jest.fn();

        epicTester(runQueriesBatchEpic, state)
          .whenActionIsDispatched(
            runQueriesBatchAction({ exploreId, queryOptions: { live: false, interval: '', maxDataPoints: 1980 } }) // first observable
          )
          .whenQueryReceivesResponse(response)
          .whenQueryObserverReceivesEvent({
            key: 'some key',
            request: {} as DataQueryRequest,
            state: LoadingState.Loading, // fake just to setup and test unsubscribe
            unsubscribe,
          })
          .whenActionIsDispatched(
            // second observable and unsubscribes the first observable
            runQueriesBatchAction({ exploreId, queryOptions: { live: true, interval: '', maxDataPoints: 800 } })
          )
          .whenQueryReceivesResponse(response)
          .whenQueryObserverReceivesEvent({
            key: 'some key',
            request: {} as DataQueryRequest,
            state: LoadingState.Loading, // fake just to setup and test unsubscribe
            unsubscribe,
          })
          .thenResultingActionsEqual(
            queryStartAction({ exploreId }), // output from first observable
            historyUpdatedAction({ exploreId, history }), // output from first observable
            processQueryResultsAction({
              exploreId,
              delta: null,
              series,
              latency: 0,
              datasourceId,
              loadingState: LoadingState.Done,
            }),
            stateSaveAction(),
            // output from first observable
            queryStartAction({ exploreId }), // output from second observable
            historyUpdatedAction({ exploreId, history }), // output from second observable
            processQueryResultsAction({
              exploreId,
              delta: null,
              series,
              latency: 0,
              datasourceId,
              loadingState: LoadingState.Done,
            }),
            stateSaveAction()
            // output from second observable
          );

        expect(unsubscribe).toBeCalledTimes(1); // first unsubscribe should be called but not second as that isn't unsubscribed
      });
    });

    describe('and resetExploreAction is dispatched', () => {
      it('then the observable should be unsubscribed', () => {
        const { response, series } = testContext();
        const { exploreId, state, history, datasourceId } = mockExploreState();
        const unsubscribe = jest.fn();

        epicTester(runQueriesBatchEpic, state)
          .whenActionIsDispatched(
            runQueriesBatchAction({ exploreId, queryOptions: { live: false, interval: '', maxDataPoints: 1980 } })
          )
          .whenQueryReceivesResponse(response)
          .whenQueryObserverReceivesEvent({
            key: 'some key',
            request: {} as DataQueryRequest,
            state: LoadingState.Loading, // fake just to setup and test unsubscribe
            unsubscribe,
          })
          .whenActionIsDispatched(resetExploreAction()) // unsubscribes the observable
          .whenQueryReceivesResponse(response) // new updates will not reach anywhere
          .thenResultingActionsEqual(
            queryStartAction({ exploreId }),
            historyUpdatedAction({ exploreId, history }),
            processQueryResultsAction({
              exploreId,
              delta: null,
              series,
              latency: 0,
              datasourceId,
              loadingState: LoadingState.Done,
            }),
            stateSaveAction()
          );

        expect(unsubscribe).toBeCalledTimes(1);
      });
    });

    describe('and updateDatasourceInstanceAction is dispatched', () => {
      it('then the observable should be unsubscribed', () => {
        const { response, series } = testContext();
        const { exploreId, state, history, datasourceId, datasourceInstance } = mockExploreState();
        const unsubscribe = jest.fn();

        epicTester(runQueriesBatchEpic, state)
          .whenActionIsDispatched(
            runQueriesBatchAction({ exploreId, queryOptions: { live: false, interval: '', maxDataPoints: 1980 } })
          )
          .whenQueryReceivesResponse(response)
          .whenQueryObserverReceivesEvent({
            key: 'some key',
            request: {} as DataQueryRequest,
            state: LoadingState.Loading, // fake just to setup and test unsubscribe
            unsubscribe,
          })
          .whenActionIsDispatched(updateDatasourceInstanceAction({ exploreId, datasourceInstance })) // unsubscribes the observable
          .whenQueryReceivesResponse(response) // new updates will not reach anywhere
          .thenResultingActionsEqual(
            queryStartAction({ exploreId }),
            historyUpdatedAction({ exploreId, history }),
            processQueryResultsAction({
              exploreId,
              delta: null,
              series,
              latency: 0,
              datasourceId,
              loadingState: LoadingState.Done,
            }),
            stateSaveAction()
          );

        expect(unsubscribe).toBeCalledTimes(1);
      });
    });

    describe('and changeRefreshIntervalAction is dispatched', () => {
      it('then the observable should be unsubscribed', () => {
        const { response, series } = testContext();
        const { exploreId, state, history, datasourceId } = mockExploreState();
        const unsubscribe = jest.fn();

        epicTester(runQueriesBatchEpic, state)
          .whenActionIsDispatched(
            runQueriesBatchAction({ exploreId, queryOptions: { live: false, interval: '', maxDataPoints: 1980 } })
          )
          .whenQueryReceivesResponse(response)
          .whenQueryObserverReceivesEvent({
            key: 'some key',
            request: {} as DataQueryRequest,
            state: LoadingState.Loading, // fake just to setup and test unsubscribe
            unsubscribe,
          })
          .whenActionIsDispatched(changeRefreshIntervalAction({ exploreId, refreshInterval: '' })) // unsubscribes the observable
          .whenQueryReceivesResponse(response) // new updates will not reach anywhere
          .thenResultingActionsEqual(
            queryStartAction({ exploreId }),
            historyUpdatedAction({ exploreId, history }),
            processQueryResultsAction({
              exploreId,
              delta: null,
              series,
              latency: 0,
              datasourceId,
              loadingState: LoadingState.Done,
            }),
            stateSaveAction()
          );

        expect(unsubscribe).toBeCalledTimes(1);
      });
    });

    describe('and clearQueriesAction is dispatched', () => {
      it('then the observable should be unsubscribed', () => {
        const { response, series } = testContext();
        const { exploreId, state, history, datasourceId } = mockExploreState();
        const unsubscribe = jest.fn();

        epicTester(runQueriesBatchEpic, state)
          .whenActionIsDispatched(
            runQueriesBatchAction({ exploreId, queryOptions: { live: false, interval: '', maxDataPoints: 1980 } })
          )
          .whenQueryReceivesResponse(response)
          .whenQueryObserverReceivesEvent({
            key: 'some key',
            request: {} as DataQueryRequest,
            state: LoadingState.Loading, // fake just to setup and test unsubscribe
            unsubscribe,
          })
          .whenActionIsDispatched(clearQueriesAction({ exploreId })) // unsubscribes the observable
          .whenQueryReceivesResponse(response) // new updates will not reach anywhere
          .thenResultingActionsEqual(
            queryStartAction({ exploreId }),
            historyUpdatedAction({ exploreId, history }),
            processQueryResultsAction({
              exploreId,
              delta: null,
              series,
              latency: 0,
              datasourceId,
              loadingState: LoadingState.Done,
            }),
            stateSaveAction()
          );

        expect(unsubscribe).toBeCalledTimes(1);
      });
    });
  });
});
