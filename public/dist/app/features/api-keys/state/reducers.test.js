import { ActionTypes } from './actions';
import { initialApiKeysState, apiKeysReducer } from './reducers';
import { getMultipleMockKeys } from '../__mocks__/apiKeysMock';
describe('API Keys reducer', function () {
    it('should set keys', function () {
        var payload = getMultipleMockKeys(4);
        var action = {
            type: ActionTypes.LoadApiKeys,
            payload: payload,
        };
        var result = apiKeysReducer(initialApiKeysState, action);
        expect(result.keys).toEqual(payload);
    });
    it('should set search query', function () {
        var payload = 'test query';
        var action = {
            type: ActionTypes.SetApiKeysSearchQuery,
            payload: payload,
        };
        var result = apiKeysReducer(initialApiKeysState, action);
        expect(result.searchQuery).toEqual('test query');
    });
});
//# sourceMappingURL=reducers.test.js.map