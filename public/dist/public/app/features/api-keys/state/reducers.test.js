import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { getMultipleMockKeys } from '../__mocks__/apiKeysMock';
import { apiKeysLoaded, apiKeysReducer, includeExpiredToggled, initialApiKeysState, isFetching, setSearchQuery, } from './reducers';
describe('API Keys reducer', () => {
    it('should set keys', () => {
        reducerTester()
            .givenReducer(apiKeysReducer, Object.assign({}, initialApiKeysState))
            .whenActionIsDispatched(apiKeysLoaded({ keys: getMultipleMockKeys(4), keysIncludingExpired: getMultipleMockKeys(6) }))
            .thenStateShouldEqual(Object.assign(Object.assign({}, initialApiKeysState), { keys: getMultipleMockKeys(4), keysIncludingExpired: getMultipleMockKeys(6), hasFetched: true }));
    });
    it('should set search query', () => {
        reducerTester()
            .givenReducer(apiKeysReducer, Object.assign({}, initialApiKeysState))
            .whenActionIsDispatched(setSearchQuery('test query'))
            .thenStateShouldEqual(Object.assign(Object.assign({}, initialApiKeysState), { searchQuery: 'test query' }));
    });
    it('should toggle the includeExpired state', () => {
        reducerTester()
            .givenReducer(apiKeysReducer, Object.assign({}, initialApiKeysState))
            .whenActionIsDispatched(includeExpiredToggled())
            .thenStateShouldEqual(Object.assign(Object.assign({}, initialApiKeysState), { includeExpired: true }));
    });
    it('should set state when fetching', () => {
        reducerTester()
            .givenReducer(apiKeysReducer, Object.assign({}, initialApiKeysState))
            .whenActionIsDispatched(isFetching())
            .thenStateShouldEqual(Object.assign(Object.assign({}, initialApiKeysState), { hasFetched: false }));
    });
});
//# sourceMappingURL=reducers.test.js.map