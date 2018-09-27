import { Action, ActionTypes } from './actions';
import { initialApiKeysState, apiKeysReducer } from './reducers';
import { getMultipleMockKeys } from '../__mocks__/apiKeysMock';

describe('API Keys reducer', () => {
  it('should set keys', () => {
    const payload = getMultipleMockKeys(4);

    const action: Action = {
      type: ActionTypes.LoadApiKeys,
      payload,
    };

    const result = apiKeysReducer(initialApiKeysState, action);

    expect(result.keys).toEqual(payload);
  });

  it('should set search query', () => {
    const payload = 'test query';

    const action: Action = {
      type: ActionTypes.SetApiKeysSearchQuery,
      payload,
    };

    const result = apiKeysReducer(initialApiKeysState, action);

    expect(result.searchQuery).toEqual('test query');
  });
});
