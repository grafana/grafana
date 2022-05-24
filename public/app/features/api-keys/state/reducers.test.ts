import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { ApiKeysState } from '../../../types';
import { getMultipleMockKeys } from '../__mocks__/apiKeysMock';

import {
  apiKeysLoaded,
  apiKeysReducer,
  includeExpiredToggled,
  initialApiKeysState,
  isFetching,
  setSearchQuery,
} from './reducers';

describe('API Keys reducer', () => {
  it('should set keys', () => {
    reducerTester<ApiKeysState>()
      .givenReducer(apiKeysReducer, { ...initialApiKeysState })
      .whenActionIsDispatched(
        apiKeysLoaded({ keys: getMultipleMockKeys(4), keysIncludingExpired: getMultipleMockKeys(6) })
      )
      .thenStateShouldEqual({
        ...initialApiKeysState,
        keys: getMultipleMockKeys(4),
        keysIncludingExpired: getMultipleMockKeys(6),
        hasFetched: true,
      });
  });

  it('should set search query', () => {
    reducerTester<ApiKeysState>()
      .givenReducer(apiKeysReducer, { ...initialApiKeysState })
      .whenActionIsDispatched(setSearchQuery('test query'))
      .thenStateShouldEqual({
        ...initialApiKeysState,
        searchQuery: 'test query',
      });
  });

  it('should toggle the includeExpired state', () => {
    reducerTester<ApiKeysState>()
      .givenReducer(apiKeysReducer, { ...initialApiKeysState })
      .whenActionIsDispatched(includeExpiredToggled())
      .thenStateShouldEqual({
        ...initialApiKeysState,
        includeExpired: true,
      });
  });

  it('should set state when fetching', () => {
    reducerTester<ApiKeysState>()
      .givenReducer(apiKeysReducer, { ...initialApiKeysState })
      .whenActionIsDispatched(isFetching())
      .thenStateShouldEqual({
        ...initialApiKeysState,
        hasFetched: false,
      });
  });
});
