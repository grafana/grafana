import { __assign } from "tslib";
import { apiKeysLoaded, apiKeysReducer, initialApiKeysState, setSearchQuery } from './reducers';
import { getMultipleMockKeys } from '../__mocks__/apiKeysMock';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
describe('API Keys reducer', function () {
    it('should set keys', function () {
        reducerTester()
            .givenReducer(apiKeysReducer, __assign({}, initialApiKeysState))
            .whenActionIsDispatched(apiKeysLoaded(getMultipleMockKeys(4)))
            .thenStateShouldEqual(__assign(__assign({}, initialApiKeysState), { keys: getMultipleMockKeys(4), hasFetched: true }));
    });
    it('should set search query', function () {
        reducerTester()
            .givenReducer(apiKeysReducer, __assign({}, initialApiKeysState))
            .whenActionIsDispatched(setSearchQuery('test query'))
            .thenStateShouldEqual(__assign(__assign({}, initialApiKeysState), { searchQuery: 'test query' }));
    });
});
//# sourceMappingURL=reducers.test.js.map