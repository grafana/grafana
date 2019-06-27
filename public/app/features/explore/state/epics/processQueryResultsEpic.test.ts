import { mockExploreState } from 'test/mocks/mockExploreState';
import { epicTester, MOCKED_ABSOLUTE_RANGE } from 'test/core/redux/epicTester';
import {
  processQueryResultsAction,
  resetQueryErrorAction,
  querySuccessAction,
  scanStopAction,
  updateTimeRangeAction,
  runQueriesAction,
} from '../actionTypes';
import { SeriesData, LoadingState } from '@grafana/ui';
import { processQueryResultsEpic } from './processQueryResultsEpic';
import TableModel from 'app/core/table_model';

const testContext = () => {
  const serieA: SeriesData = {
    fields: [],
    refId: 'A',
    rows: [],
  };
  const serieB: SeriesData = {
    fields: [],
    refId: 'B',
    rows: [],
  };
  const series = [serieA, serieB];
  const latency = 0;
  const loadingState = LoadingState.Done;

  return {
    latency,
    series,
    loadingState,
  };
};

describe('processQueryResultsEpic', () => {
  describe('when processQueryResultsAction is dispatched', () => {
    describe('and datasourceInstance is the same', () => {
      describe('and explore is not scanning', () => {
        it('then resetQueryErrorAction and querySuccessAction are dispatched and eventBridge emits correct message', () => {
          const { datasourceId, exploreId, state, eventBridge } = mockExploreState();
          const { latency, series, loadingState } = testContext();
          const graphResult = [];
          const tableResult = new TableModel();
          const logsResult = null;

          epicTester(processQueryResultsEpic, state)
            .whenActionIsDispatched(
              processQueryResultsAction({ exploreId, datasourceId, loadingState, series, latency })
            )
            .thenResultingActionsEqual(
              resetQueryErrorAction({ exploreId, refIds: ['A', 'B'] }),
              querySuccessAction({ exploreId, loadingState, graphResult, tableResult, logsResult, latency })
            );

          expect(eventBridge.emit).toBeCalledTimes(1);
          expect(eventBridge.emit).toBeCalledWith('data-received', series);
        });
      });

      describe('and explore is scanning', () => {
        describe('and we have a result', () => {
          it('then correct actions are dispatched', () => {
            const { datasourceId, exploreId, state } = mockExploreState({ scanning: true });
            const { latency, series, loadingState } = testContext();
            const graphResult = [];
            const tableResult = new TableModel();
            const logsResult = null;

            epicTester(processQueryResultsEpic, state)
              .whenActionIsDispatched(
                processQueryResultsAction({ exploreId, datasourceId, loadingState, series, latency })
              )
              .thenResultingActionsEqual(
                resetQueryErrorAction({ exploreId, refIds: ['A', 'B'] }),
                querySuccessAction({ exploreId, loadingState, graphResult, tableResult, logsResult, latency }),
                scanStopAction({ exploreId })
              );
          });
        });

        describe('and we do not have a result', () => {
          it('then correct actions are dispatched', () => {
            const { datasourceId, exploreId, state } = mockExploreState({ scanning: true });
            const { latency, loadingState } = testContext();
            const graphResult = [];
            const tableResult = new TableModel();
            const logsResult = null;

            epicTester(processQueryResultsEpic, state)
              .whenActionIsDispatched(
                processQueryResultsAction({ exploreId, datasourceId, loadingState, series: [], latency })
              )
              .thenResultingActionsEqual(
                resetQueryErrorAction({ exploreId, refIds: [] }),
                querySuccessAction({ exploreId, loadingState, graphResult, tableResult, logsResult, latency }),
                updateTimeRangeAction({ exploreId, absoluteRange: MOCKED_ABSOLUTE_RANGE }),
                runQueriesAction({ exploreId })
              );
          });
        });
      });
    });

    describe('and datasourceInstance is not the same', () => {
      it('then no actions are dispatched and eventBridge does not emit message', () => {
        const { exploreId, state, eventBridge } = mockExploreState();
        const { series, loadingState } = testContext();

        epicTester(processQueryResultsEpic, state)
          .whenActionIsDispatched(
            processQueryResultsAction({ exploreId, datasourceId: 'other id', loadingState, series, latency: 0 })
          )
          .thenNoActionsWhereDispatched();

        expect(eventBridge.emit).not.toBeCalled();
      });
    });
  });
});
