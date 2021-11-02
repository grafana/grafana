import { getApiKeys } from './selectors';
import { getMultipleMockKeys } from '../__mocks__/apiKeysMock';
describe('API Keys selectors', function () {
    describe('Get API Keys', function () {
        var mockKeys = getMultipleMockKeys(5);
        it('should return all keys if no search query', function () {
            var mockState = { keys: mockKeys, searchQuery: '', hasFetched: false };
            var keys = getApiKeys(mockState);
            expect(keys).toEqual(mockKeys);
        });
        it('should filter keys if search query exists', function () {
            var mockState = { keys: mockKeys, searchQuery: '5', hasFetched: false };
            var keys = getApiKeys(mockState);
            expect(keys.length).toEqual(1);
        });
    });
});
//# sourceMappingURL=selectors.test.js.map