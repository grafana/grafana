import { mockExploreState } from 'test/mocks/mockExploreState';
import { epicTester } from 'test/core/redux/epicTester';
import {
  processQueryErrorsAction,
  processQueryResultsAction,
  resetQueryErrorAction,
  querySuccessAction,
  scanStopAction,
  scanRangeAction,
} from '../actionTypes';
import { processQueryErrorsEpic } from './processQueryErrorsEpic';
import { SeriesData } from '@grafana/ui';
import { processQueryResultsEpic } from './processQueryResultsEpic';

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
  const response = { data: series };
  const replacePreviousResults = true;

  return {
    latency,
    response,
    series,
    replacePreviousResults,
  };
};

describe('processQueryResultsEpic', () => {
  describe('when processQueryResultsAction is dispatched', () => {
    describe('and datasourceInstance is the same', () => {
      describe('and explore is not scanning', () => {
        it('then resetQueryErrorAction and querySuccessAction are dispatched', () => {
          const { datasourceId, exploreId, state } = mockExploreState();
          const { latency, response, series, replacePreviousResults } = testContext();

          epicTester(processQueryResultsEpic, state)
            .whenActionIsDispatched(
              processQueryResultsAction({ exploreId, datasourceId, response, latency, replacePreviousResults })
            )
            .thenResultingActionsEqual(
              resetQueryErrorAction({ exploreId, refIds: ['A', 'B'] }),
              querySuccessAction({ exploreId, result: series, latency, replacePreviousResults })
            );
        });
      });

      describe('and explore is scanning', () => {
        describe('and we have a result', () => {
          it('then correct actions are dispatched', () => {
            const { datasourceId, exploreId, state } = mockExploreState({ scanning: true });
            const { latency, response, series, replacePreviousResults } = testContext();

            epicTester(processQueryResultsEpic, state)
              .whenActionIsDispatched(
                processQueryResultsAction({ exploreId, datasourceId, response, latency, replacePreviousResults })
              )
              .thenResultingActionsEqual(
                resetQueryErrorAction({ exploreId, refIds: ['A', 'B'] }),
                querySuccessAction({ exploreId, result: series, latency, replacePreviousResults }),
                scanStopAction({ exploreId })
              );
          });
        });

        describe('and we do not have a result', () => {
          it('then correct actions are dispatched', () => {
            const { datasourceId, exploreId, state, scanner } = mockExploreState({ scanning: true });
            const { latency, replacePreviousResults } = testContext();

            epicTester(processQueryResultsEpic, state)
              .whenActionIsDispatched(
                processQueryResultsAction({
                  exploreId,
                  datasourceId,
                  response: { data: [] },
                  latency,
                  replacePreviousResults,
                })
              )
              .thenResultingActionsEqual(
                resetQueryErrorAction({ exploreId, refIds: [] }),
                querySuccessAction({ exploreId, result: [], latency, replacePreviousResults }),
                scanRangeAction({ exploreId, range: scanner() })
              );
          });
        });
      });
    });

    describe('and datasourceInstance is not the same', () => {
      it('then no actions are dispatched', () => {
        const { exploreId, state } = mockExploreState();
        const { response } = testContext();

        epicTester(processQueryErrorsEpic, state)
          .whenActionIsDispatched(processQueryErrorsAction({ exploreId, datasourceId: 'other id', response }))
          .thenNoActionsWhereDispatched();
      });
    });
  });
});
