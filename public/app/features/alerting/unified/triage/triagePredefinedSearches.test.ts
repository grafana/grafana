import { extractFilterObjects } from './scene/triageSavedSearchUtils';
import {
  TRIAGE_DEFAULT_PREDEFINED_SEARCH_ID,
  TRIAGE_PREDEFINED_SEARCH_ID_PREFIX,
  getTriagePredefinedSearches,
  isTriagePredefinedSearchId,
} from './triagePredefinedSearches';

describe('triagePredefinedSearches', () => {
  describe('getTriagePredefinedSearches()', () => {
    it('each search has stable id, name, isDefault false, and non-empty query', () => {
      for (const search of getTriagePredefinedSearches()) {
        expect(search.id).toMatch(new RegExp(`^${TRIAGE_PREDEFINED_SEARCH_ID_PREFIX}`));
        expect(typeof search.name).toBe('string');
        expect(search.name.length).toBeGreaterThan(0);
        expect(typeof search.isDefault).toBe('boolean');
        expect(typeof search.query).toBe('string');
        expect(search.query.length).toBeGreaterThan(0);
      }
    });

    it('all predefined searches use default time range (15m from scene/utils)', () => {
      for (const search of getTriagePredefinedSearches()) {
        const params = new URLSearchParams(search.query);
        expect(params.get('from')).toBe('now-15m');
        expect(params.get('to')).toBe('now');
      }
    });

    it('first search has filter firing and groupBy folder', () => {
      const first = getTriagePredefinedSearches()[0];
      const params = new URLSearchParams(first.query);
      expect(params.getAll('var-groupBy')).toEqual(['grafana_folder']);
      const filters = extractFilterObjects(first.query);
      expect(filters).toHaveLength(1);
      expect(filters[0]).toMatchObject({ key: 'alertstate', value: 'firing' });
    });

    it('second search has filter firing only (no groupBy)', () => {
      const second = getTriagePredefinedSearches()[1];
      const params = new URLSearchParams(second.query);
      expect(params.getAll('var-groupBy')).toEqual([]);
      const filters = extractFilterObjects(second.query);
      expect(filters).toHaveLength(1);
      expect(filters[0]).toMatchObject({ key: 'alertstate', value: 'firing' });
    });

    it('third search has groupBy folder only', () => {
      const third = getTriagePredefinedSearches()[2];
      const params = new URLSearchParams(third.query);
      expect(params.getAll('var-groupBy')).toEqual(['grafana_folder']);
      expect(params.has('var-filters')).toBe(false);
    });

    it('default predefined search is folder-firing (firing, grouped by folder)', () => {
      expect(TRIAGE_DEFAULT_PREDEFINED_SEARCH_ID).toBe('triage-predefined-folder-firing');
      const searches = getTriagePredefinedSearches();
      const defaultSearch = searches.find((s) => s.id === TRIAGE_DEFAULT_PREDEFINED_SEARCH_ID);
      expect(defaultSearch).toBeDefined();
      expect(defaultSearch!.isDefault).toBe(true);
      const params = new URLSearchParams(defaultSearch!.query);
      expect(params.getAll('var-groupBy')).toEqual(['grafana_folder']);
      const filters = extractFilterObjects(defaultSearch!.query);
      expect(filters).toHaveLength(1);
      expect(filters[0]).toMatchObject({ key: 'alertstate', value: 'firing' });
    });
  });

  describe('isTriagePredefinedSearchId', () => {
    it('returns true for predefined ids', () => {
      expect(isTriagePredefinedSearchId(`${TRIAGE_PREDEFINED_SEARCH_ID_PREFIX}folder-firing`)).toBe(true);
      expect(isTriagePredefinedSearchId(`${TRIAGE_PREDEFINED_SEARCH_ID_PREFIX}firing-only`)).toBe(true);
      expect(isTriagePredefinedSearchId(`${TRIAGE_PREDEFINED_SEARCH_ID_PREFIX}folder-only`)).toBe(true);
    });

    it('returns false for user-generated ids', () => {
      expect(isTriagePredefinedSearchId('abc-123')).toBe(false);
      expect(isTriagePredefinedSearchId('triage-predefined-x')).toBe(true); // prefix match
    });
  });
});
