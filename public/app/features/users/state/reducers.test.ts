import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { UsersState } from '../../../types';
import { getMockUsers } from '../__mocks__/userMocks';

import { initialState, setUsersSearchQuery, usersLoaded, usersReducer } from './reducers';

describe('usersReducer', () => {
  describe('when usersLoaded is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<UsersState>()
        .givenReducer(usersReducer, { ...initialState })
        .whenActionIsDispatched(usersLoaded(getMockUsers(1)))
        .thenStateShouldEqual({
          ...initialState,
          users: getMockUsers(1),
          hasFetched: true,
        });
    });
  });

  describe('when setUsersSearchQuery is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<UsersState>()
        .givenReducer(usersReducer, { ...initialState })
        .whenActionIsDispatched(setUsersSearchQuery('a query'))
        .thenStateShouldEqual({
          ...initialState,
          searchQuery: 'a query',
        });
    });
  });
});
