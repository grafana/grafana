import { getPlugins, getPluginsSearchQuery } from './selectors';
import { initialState } from './reducers';
import { getMockPlugins } from '../__mocks__/pluginMocks';

describe('Selectors', () => {
  const mockState = initialState;

  it('should return search query', () => {
    mockState.searchQuery = 'test';
    const query = getPluginsSearchQuery(mockState);

    expect(query).toEqual(mockState.searchQuery);
  });

  it('should return plugins', () => {
    mockState.plugins = getMockPlugins(5);
    mockState.searchQuery = '';

    const plugins = getPlugins(mockState);

    expect(plugins).toEqual(mockState.plugins);
  });

  it('should filter plugins', () => {
    mockState.searchQuery = 'plugin-1';

    const plugins = getPlugins(mockState);

    expect(plugins.length).toEqual(1);
  });
});
