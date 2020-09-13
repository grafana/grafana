import { apiKeysLoaded, apiKeysReducer, initialApiKeysState, setSearchQuery } from './reducers';
import { getMultipleMockKeys } from '../__mocks__/apiKeysMock';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { ApiKeysState } from '../../../types';

describe('API Keys reducer', () => {
  it('should set keys', () => {
    reducerTester<ApiKeysState>()
      .givenReducer(apiKeysReducer, { ...initialApiKeysState })
      .whenActionIsDispatched(apiKeysLoaded(getMultipleMockKeys(4)))
      .thenStateShouldEqual({
        ...initialApiKeysState,
        keys: getMultipleMockKeys(4),
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
});
