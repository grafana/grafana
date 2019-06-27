import { epicTester } from 'test/core/redux/epicTester';
import { stateSaveEpic } from './stateSaveEpic';
import { stateSaveAction, setUrlReplacedAction } from '../actionTypes';
import { updateLocation } from 'app/core/actions/location';
import { mockExploreState } from 'test/mocks/mockExploreState';

describe('stateSaveEpic', () => {
  describe('when stateSaveAction is dispatched', () => {
    describe('and there is a left state', () => {
      describe('and no split', () => {
        it('then the correct actions are dispatched', () => {
          const { exploreId, state } = mockExploreState();

          epicTester(stateSaveEpic, state)
            .whenActionIsDispatched(stateSaveAction())
            .thenResultingActionsEqual(
              updateLocation({
                query: { left: '["now-6h","now","test",{"mode":null},{"ui":[true,true,true,null]}]' },
                replace: true,
              }),
              setUrlReplacedAction({ exploreId })
            );
        });
      });

      describe('and explore is splitted', () => {
        it('then the correct actions are dispatched', () => {
          const { exploreId, state } = mockExploreState({ split: true });

          epicTester(stateSaveEpic, state)
            .whenActionIsDispatched(stateSaveAction())
            .thenResultingActionsEqual(
              updateLocation({
                query: {
                  left: '["now-6h","now","test",{"mode":null},{"ui":[true,true,true,null]}]',
                  right: '["now-6h","now","test",{"mode":null},{"ui":[true,true,true,null]}]',
                },
                replace: true,
              }),
              setUrlReplacedAction({ exploreId })
            );
        });
      });
    });

    describe('and urlReplaced is true', () => {
      it('then setUrlReplacedAction should not be dispatched', () => {
        const { state } = mockExploreState({ urlReplaced: true });

        epicTester(stateSaveEpic, state)
          .whenActionIsDispatched(stateSaveAction())
          .thenResultingActionsEqual(
            updateLocation({
              query: { left: '["now-6h","now","test",{"mode":null},{"ui":[true,true,true,null]}]' },
              replace: false,
            })
          );
      });
    });
  });
});
