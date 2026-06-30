import { getStoredFilterDefaults, storeFilterDefaults } from './filterDefaults';

describe('filterDefaults', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty object when nothing is stored', () => {
    expect(getStoredFilterDefaults('recent')).toEqual({});
  });

  it('stores and retrieves filter defaults', () => {
    storeFilterDefaults('recent', { searchQuery: 'hello', rememberFilters: true });
    expect(getStoredFilterDefaults('recent')).toEqual({ searchQuery: 'hello', rememberFilters: true });
  });

  it('uses namespace to separate keys', () => {
    storeFilterDefaults('recent', { searchQuery: 'a' });
    storeFilterDefaults('saved', { searchQuery: 'b' });
    expect(getStoredFilterDefaults('recent')).toEqual({ searchQuery: 'a' });
    expect(getStoredFilterDefaults('saved')).toEqual({ searchQuery: 'b' });
  });

  it('clears stored defaults when empty object is stored', () => {
    storeFilterDefaults('recent', { searchQuery: 'hello' });
    storeFilterDefaults('recent', {});
    expect(getStoredFilterDefaults('recent')).toEqual({});
  });

  it('handles corrupted JSON gracefully', () => {
    localStorage.setItem('grafana.recentQueries.filterDefaults.recent', 'not-json');
    expect(getStoredFilterDefaults('recent')).toEqual({});
  });
});
