import { mockExploreState } from 'test/mocks/mockExploreState';
import { epicTester } from 'test/core/redux/epicTester';
import { processQueryErrorsAction, queryFailureAction } from '../actionTypes';
import { processQueryErrorsEpic } from './processQueryErrorsEpic';

describe('processQueryErrorsEpic', () => {
  let originalConsoleError = console.error;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('when processQueryErrorsAction is dispatched', () => {
    describe('and datasourceInstance is the same', () => {
      describe('and the response is not cancelled', () => {
        it('then queryFailureAction is dispatched', () => {
          const { datasourceId, exploreId, state } = mockExploreState();
          const response = { message: 'Something went terribly wrong!' };

          epicTester(processQueryErrorsEpic, state)
            .whenActionIsDispatched(processQueryErrorsAction({ exploreId, datasourceId, response }))
            .thenResultingActionsEqual(queryFailureAction({ exploreId, response }));

          expect(console.error).toBeCalledTimes(1);
          expect(console.error).toBeCalledWith(response);
        });
      });

      describe('and the response is cancelled', () => {
        it('then no actions are dispatched', () => {
          const { datasourceId, exploreId, state } = mockExploreState();
          const response = { cancelled: true, message: 'Something went terribly wrong!' };

          epicTester(processQueryErrorsEpic, state)
            .whenActionIsDispatched(processQueryErrorsAction({ exploreId, datasourceId, response }))
            .thenNoActionsWhereDispatched();

          expect(console.error).not.toBeCalled();
        });
      });
    });

    describe('and datasourceInstance is not the same', () => {
      describe('and the response is not cancelled', () => {
        it('then no actions are dispatched', () => {
          const { exploreId, state } = mockExploreState();
          const response = { message: 'Something went terribly wrong!' };

          epicTester(processQueryErrorsEpic, state)
            .whenActionIsDispatched(processQueryErrorsAction({ exploreId, datasourceId: 'other id', response }))
            .thenNoActionsWhereDispatched();

          expect(console.error).not.toBeCalled();
        });
      });
    });
  });
});
