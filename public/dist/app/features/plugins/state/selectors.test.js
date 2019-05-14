import { getPlugins, getPluginsSearchQuery } from './selectors';
import { initialState } from './reducers';
import { getMockPlugins } from '../__mocks__/pluginMocks';
describe('Selectors', function () {
    var mockState = initialState;
    it('should return search query', function () {
        mockState.searchQuery = 'test';
        var query = getPluginsSearchQuery(mockState);
        expect(query).toEqual(mockState.searchQuery);
    });
    it('should return plugins', function () {
        mockState.plugins = getMockPlugins(5);
        mockState.searchQuery = '';
        var plugins = getPlugins(mockState);
        expect(plugins).toEqual(mockState.plugins);
    });
    it('should filter plugins', function () {
        mockState.searchQuery = 'plugin-1';
        var plugins = getPlugins(mockState);
        expect(plugins.length).toEqual(1);
    });
});
//# sourceMappingURL=selectors.test.js.map