import { UsersState } from 'app/types/user';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { getMockUsers, getFetchUsersMock } from '../mocks/userMocks';

import { initialState, searchQueryChanged, usersLoaded, usersReducer } from './reducers';

describe('usersReducer', () => {
  describe('when usersLoaded is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<UsersState>()
        .givenReducer(usersReducer, { ...initialState })
        .whenActionIsDispatched(usersLoaded(getFetchUsersMock(1)))
        .thenStateShouldEqual({
          ...initialState,
          users: getMockUsers(1),
          isLoading: true,
        });
    });
  });

  describe('when searchQueryChanged is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<UsersState>()
        .givenReducer(usersReducer, { ...initialState })
        .whenActionIsDispatched(searchQueryChanged('a query'))
        .thenStateShouldEqual({
          ...initialState,
          searchQuery: 'a query',
        });
    });
  });
});
