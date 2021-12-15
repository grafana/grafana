import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { ServiceaccountsState } from '../../../types';
import { initialState, serviceaccountsLoaded, serviceaccountsReducer, setserviceaccountsSearchQuery } from './reducers';
import { getMockserviceaccounts } from '../__mocks__/serviceaccountsMocks';

describe('usersReducer', () => {
  describe('when usersLoaded is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<ServiceaccountsState>()
        .givenReducer(serviceaccountsReducer, { ...initialState })
        .whenActionIsDispatched(serviceaccountsLoaded(getMockserviceaccounts(1)))
        .thenStateShouldEqual({
          ...initialState,
          serviceaccounts: getMockserviceaccounts(1),
          hasFetched: true,
        });
    });
  });

  describe('when setUsersSearchQuery is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<ServiceaccountsState>()
        .givenReducer(serviceaccountsReducer, { ...initialState })
        .whenActionIsDispatched(setserviceaccountsSearchQuery('a query'))
        .thenStateShouldEqual({
          ...initialState,
          searchQuery: 'a query',
        });
    });
  });
});
