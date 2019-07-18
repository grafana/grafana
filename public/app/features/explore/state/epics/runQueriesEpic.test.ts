import { mockExploreState } from 'test/mocks/mockExploreState';
import { epicTester } from 'test/core/redux/epicTester';
import { runQueriesAction, stateSaveAction, runQueriesBatchAction, clearQueriesAction } from '../actionTypes';
import { runQueriesEpic } from './runQueriesEpic';

describe('runQueriesEpic', () => {
  describe('when runQueriesAction is dispatched', () => {
    describe('and there is no datasourceError', () => {
      describe('and we have non empty queries', () => {
        describe('and explore is not live', () => {
          it('then runQueriesBatchAction and stateSaveAction are dispatched', () => {
            const queries = [{ refId: 'A', key: '123456', expr: '{__filename__="some.log"}' }];
            const { exploreId, state, datasourceInterval, containerWidth } = mockExploreState({ queries });

            epicTester(runQueriesEpic, state)
              .whenActionIsDispatched(runQueriesAction({ exploreId }))
              .thenResultingActionsEqual(
                runQueriesBatchAction({
                  exploreId,
                  queryOptions: { interval: datasourceInterval, maxDataPoints: containerWidth, live: false },
                })
              );
          });
        });

        describe('and explore is live', () => {
          it('then runQueriesBatchAction and stateSaveAction are dispatched', () => {
            const queries = [{ refId: 'A', key: '123456', expr: '{__filename__="some.log"}' }];
            const { exploreId, state, datasourceInterval, containerWidth } = mockExploreState({
              queries,
              isLive: true,
              streaming: true,
            });

            epicTester(runQueriesEpic, state)
              .whenActionIsDispatched(runQueriesAction({ exploreId }))
              .thenResultingActionsEqual(
                runQueriesBatchAction({
                  exploreId,
                  queryOptions: { interval: datasourceInterval, maxDataPoints: containerWidth, live: true },
                })
              );
          });
        });
      });

      describe('and we have no queries', () => {
        it('then clearQueriesAction and stateSaveAction are dispatched', () => {
          const queries = [];
          const { exploreId, state } = mockExploreState({ queries });

          epicTester(runQueriesEpic, state)
            .whenActionIsDispatched(runQueriesAction({ exploreId }))
            .thenResultingActionsEqual(clearQueriesAction({ exploreId }), stateSaveAction());
        });
      });
    });

    describe('and there is a datasourceError', () => {
      it('then no actions are dispatched', () => {
        const { exploreId, state } = mockExploreState({
          datasourceError: { message: 'Some error' },
        });

        epicTester(runQueriesEpic, state)
          .whenActionIsDispatched(runQueriesAction({ exploreId }))
          .thenNoActionsWhereDispatched();
      });
    });
  });
});
