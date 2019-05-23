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
} from '../actionTypes';
import { LoadingState, DataQueryRequest } from '@grafana/ui';

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
        it('then correct actions are dispatched and eventBridge emits correct message', () => {
          const response = { data: [{}] };
          const { exploreId, state, eventBridge, history, datasourceId } = mockExploreState();

          epicTester(runQueriesBatchEpic, state)
            .whenActionIsDispatched(
              runQueriesBatchAction({ exploreId, queryOptions: { live: false, interval: '', maxDataPoints: 1980 } })
            )
            .whenQueryReceivesResponse(response)
            .thenResultingActionsEqual(
              queryStartAction({ exploreId }),
              historyUpdatedAction({ exploreId, history }),
              processQueryResultsAction({ exploreId, response, latency: 0, datasourceId })
            );

          expect(eventBridge.emit).toBeCalledTimes(1);
          expect(eventBridge.emit).toBeCalledWith('data-received', response.data);
        });
      });

      describe('and query is not successful', () => {
        it('then correct actions are dispatched and eventBridge emits correct message', () => {
          const error = {
            message: 'Error parsing line x',
          };
          const { exploreId, state, eventBridge, datasourceId } = mockExploreState();

          epicTester(runQueriesBatchEpic, state)
            .whenActionIsDispatched(
              runQueriesBatchAction({ exploreId, queryOptions: { live: false, interval: '', maxDataPoints: 1980 } })
            )
            .whenQueryThrowsError(error)
            .thenResultingActionsEqual(
              queryStartAction({ exploreId }),
              processQueryErrorsAction({ exploreId, response: error, datasourceId })
            );

          expect(eventBridge.emit).toBeCalledTimes(1);
          expect(eventBridge.emit).toBeCalledWith('data-error', error);
        });
      });
    });

    describe('and query targets are live', () => {
      describe('and state equals Streaming', () => {
        it('then correct actions are dispatched', () => {
          const { exploreId, state } = mockExploreState();
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
              series: [serieA],
              key: 'some key',
              request: {} as DataQueryRequest,
              unsubscribe,
            })
            .whenQueryObserverReceivesEvent({
              state: LoadingState.Streaming,
              series: [serieB],
              key: 'some key',
              request: {} as DataQueryRequest,
              unsubscribe,
            })
            .thenResultingActionsEqual(
              queryStartAction({ exploreId }),
              limitMessageRatePayloadAction({ exploreId, data: serieA }),
              limitMessageRatePayloadAction({ exploreId, data: serieB })
            );
        });
      });

      describe('and state equals Error', () => {
        it('then correct actions are dispatched and eventBridge emits correct message', () => {
          const { exploreId, state, datasourceId, eventBridge } = mockExploreState();
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

          expect(eventBridge.emit).toBeCalledTimes(1);
          expect(eventBridge.emit).toBeCalledWith('data-error', error);
        });
      });

      describe('and state equals Done', () => {
        it('then correct actions are dispatched and eventBridge emits correct message', () => {
          const { exploreId, state, datasourceId, eventBridge, history } = mockExploreState();
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
          const series = [serieA, serieB];

          epicTester(runQueriesBatchEpic, state)
            .whenActionIsDispatched(
              runQueriesBatchAction({ exploreId, queryOptions: { live: true, interval: '', maxDataPoints: 1980 } })
            )
            .whenQueryObserverReceivesEvent({
              state: LoadingState.Done,
              series,
              key: 'some key',
              request: {} as DataQueryRequest,
              unsubscribe,
            })
            .thenResultingActionsEqual(
              queryStartAction({ exploreId }),
              historyUpdatedAction({ exploreId, history }),
              processQueryResultsAction({ exploreId, response: { data: series }, latency: 0, datasourceId })
            );

          expect(eventBridge.emit).toBeCalledTimes(1);
          expect(eventBridge.emit).toBeCalledWith('data-received', series);
        });
      });
    });

    describe('and another runQueriesBatchAction is dispatched', () => {
      it('then the observable should be unsubscribed', () => {
        const response = { data: [{}] };
        const { exploreId, state, eventBridge, history, datasourceId } = mockExploreState();
        const unsubscribe = jest.fn();

        epicTester(runQueriesBatchEpic, state)
          .whenActionIsDispatched(
            runQueriesBatchAction({ exploreId, queryOptions: { live: false, interval: '', maxDataPoints: 1980 } }) // first observable
          )
          .whenQueryReceivesResponse(response)
          .whenQueryObserverReceivesEvent({
            key: 'some key',
            request: {} as DataQueryRequest,
            state: LoadingState.Streaming,
            series: [],
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
            state: LoadingState.Streaming,
            series: [],
            unsubscribe,
          })
          .thenResultingActionsEqual(
            queryStartAction({ exploreId }), // output from first observable
            historyUpdatedAction({ exploreId, history }), // output from first observable
            processQueryResultsAction({ exploreId, response, latency: 0, datasourceId }), // output from first observable
            queryStartAction({ exploreId }), // output from second observable
            historyUpdatedAction({ exploreId, history }), // output from second observable
            processQueryResultsAction({ exploreId, response, latency: 0, datasourceId }) // output from second observable
          );

        expect(eventBridge.emit).toBeCalledTimes(2);
        expect(eventBridge.emit).toBeCalledWith('data-received', response.data);
        expect(unsubscribe).toBeCalledTimes(1); // first unsubscribe should be called but not second as that isn't unsubscribed
      });
    });

    describe('and resetExploreAction is dispatched', () => {
      it('then the observable should be unsubscribed', () => {
        const response = { data: [{}] };
        const { exploreId, state, eventBridge, history, datasourceId } = mockExploreState();
        const unsubscribe = jest.fn();

        epicTester(runQueriesBatchEpic, state)
          .whenActionIsDispatched(
            runQueriesBatchAction({ exploreId, queryOptions: { live: false, interval: '', maxDataPoints: 1980 } })
          )
          .whenQueryReceivesResponse(response)
          .whenQueryObserverReceivesEvent({
            key: 'some key',
            request: {} as DataQueryRequest,
            state: LoadingState.Streaming,
            series: [],
            unsubscribe,
          })
          .whenActionIsDispatched(resetExploreAction()) // unsubscribes the observable
          .whenQueryReceivesResponse(response) // new updates will not reach anywhere
          .thenResultingActionsEqual(
            queryStartAction({ exploreId }),
            historyUpdatedAction({ exploreId, history }),
            processQueryResultsAction({ exploreId, response, latency: 0, datasourceId })
          );

        expect(eventBridge.emit).toBeCalledTimes(1);
        expect(eventBridge.emit).toBeCalledWith('data-received', response.data);
        expect(unsubscribe).toBeCalledTimes(1);
      });
    });

    describe('and updateDatasourceInstanceAction is dispatched', () => {
      it('then the observable should be unsubscribed', () => {
        const response = { data: [{}] };
        const { exploreId, state, eventBridge, history, datasourceId, datasourceInstance } = mockExploreState();
        const unsubscribe = jest.fn();

        epicTester(runQueriesBatchEpic, state)
          .whenActionIsDispatched(
            runQueriesBatchAction({ exploreId, queryOptions: { live: false, interval: '', maxDataPoints: 1980 } })
          )
          .whenQueryReceivesResponse(response)
          .whenQueryObserverReceivesEvent({
            key: 'some key',
            request: {} as DataQueryRequest,
            state: LoadingState.Streaming,
            series: [],
            unsubscribe,
          })
          .whenActionIsDispatched(updateDatasourceInstanceAction({ exploreId, datasourceInstance })) // unsubscribes the observable
          .whenQueryReceivesResponse(response) // new updates will not reach anywhere
          .thenResultingActionsEqual(
            queryStartAction({ exploreId }),
            historyUpdatedAction({ exploreId, history }),
            processQueryResultsAction({ exploreId, response, latency: 0, datasourceId })
          );

        expect(eventBridge.emit).toBeCalledTimes(1);
        expect(eventBridge.emit).toBeCalledWith('data-received', response.data);
        expect(unsubscribe).toBeCalledTimes(1);
      });
    });

    describe('and changeRefreshIntervalAction is dispatched', () => {
      it('then the observable should be unsubscribed', () => {
        const response = { data: [{}] };
        const { exploreId, state, eventBridge, history, datasourceId } = mockExploreState();
        const unsubscribe = jest.fn();

        epicTester(runQueriesBatchEpic, state)
          .whenActionIsDispatched(
            runQueriesBatchAction({ exploreId, queryOptions: { live: false, interval: '', maxDataPoints: 1980 } })
          )
          .whenQueryReceivesResponse(response)
          .whenQueryObserverReceivesEvent({
            key: 'some key',
            request: {} as DataQueryRequest,
            state: LoadingState.Streaming,
            series: [],
            unsubscribe,
          })
          .whenActionIsDispatched(changeRefreshIntervalAction({ exploreId, refreshInterval: '' })) // unsubscribes the observable
          .whenQueryReceivesResponse(response) // new updates will not reach anywhere
          .thenResultingActionsEqual(
            queryStartAction({ exploreId }),
            historyUpdatedAction({ exploreId, history }),
            processQueryResultsAction({ exploreId, response, latency: 0, datasourceId })
          );

        expect(eventBridge.emit).toBeCalledTimes(1);
        expect(eventBridge.emit).toBeCalledWith('data-received', response.data);
        expect(unsubscribe).toBeCalledTimes(1);
      });
    });

    describe('and clearQueriesAction is dispatched', () => {
      it('then the observable should be unsubscribed', () => {
        const response = { data: [{}] };
        const { exploreId, state, eventBridge, history, datasourceId } = mockExploreState();
        const unsubscribe = jest.fn();

        epicTester(runQueriesBatchEpic, state)
          .whenActionIsDispatched(
            runQueriesBatchAction({ exploreId, queryOptions: { live: false, interval: '', maxDataPoints: 1980 } })
          )
          .whenQueryReceivesResponse(response)
          .whenQueryObserverReceivesEvent({
            key: 'some key',
            request: {} as DataQueryRequest,
            state: LoadingState.Streaming,
            series: [],
            unsubscribe,
          })
          .whenActionIsDispatched(clearQueriesAction({ exploreId })) // unsubscribes the observable
          .whenQueryReceivesResponse(response) // new updates will not reach anywhere
          .thenResultingActionsEqual(
            queryStartAction({ exploreId }),
            historyUpdatedAction({ exploreId, history }),
            processQueryResultsAction({ exploreId, response, latency: 0, datasourceId })
          );

        expect(eventBridge.emit).toBeCalledTimes(1);
        expect(eventBridge.emit).toBeCalledWith('data-received', response.data);
        expect(unsubscribe).toBeCalledTimes(1);
      });
    });
  });
});
