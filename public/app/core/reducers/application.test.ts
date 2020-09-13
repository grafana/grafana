import { reducerTester } from '../../../test/core/redux/reducerTester';
import { applicationReducer, toggleLogActions } from './application';
import { ApplicationState } from '../../types/application';

describe('applicationReducer', () => {
  describe('when toggleLogActions is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<ApplicationState>()
        .givenReducer(applicationReducer, { logActions: false })
        .whenActionIsDispatched(toggleLogActions())
        .thenStateShouldEqual({ logActions: true })
        .whenActionIsDispatched(toggleLogActions())
        .thenStateShouldEqual({ logActions: false });
    });
  });
});
