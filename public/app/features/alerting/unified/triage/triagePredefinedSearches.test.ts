import {
  AdHocFiltersVariable,
  EmbeddedScene,
  SceneFlexLayout,
  SceneTimeRange,
  SceneVariableSet,
} from '@grafana/scenes';

import { applyTriageSavedSearchState } from './scene/triageSavedSearchUtils';
import {
  TRIAGE_DEFAULT_PREDEFINED_SEARCH_ID,
  TRIAGE_PREDEFINED_SEARCH_ID_PREFIX,
  getTriagePredefinedSearches,
  isTriagePredefinedSearchId,
} from './triagePredefinedSearches';

describe('triagePredefinedSearches', () => {
  describe('getTriagePredefinedSearches()', () => {
    let variable: AdHocFiltersVariable;
    let scene: EmbeddedScene;

    beforeEach(() => {
      variable = new AdHocFiltersVariable({ name: 'filters', enableGroupBy: true, applyMode: 'manual' });
      scene = new EmbeddedScene({
        $variables: new SceneVariableSet({ variables: [variable] }),
        $timeRange: new SceneTimeRange(),
        body: new SceneFlexLayout({ children: [] }),
      });
    });

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
      // groupBy is encoded in var-filters as grafana_folder|groupBy
      expect(params.getAll('var-filters')).toContain('grafana_folder|groupBy');
      expect(params.has('var-groupBy')).toBe(false);
      applyTriageSavedSearchState(scene, first.query);

      expect(variable.state.filters).toMatchObject([
        { key: 'alertstate', operator: '=', value: 'firing' },
        { key: 'grafana_folder', operator: 'groupBy', value: '' },
      ]);
    });

    it('second search has filter firing only (no groupBy)', () => {
      const second = getTriagePredefinedSearches()[1];
      const params = new URLSearchParams(second.query);
      expect(params.has('var-groupBy')).toBe(false);
      applyTriageSavedSearchState(scene, second.query);

      expect(variable.state.filters).toMatchObject([{ key: 'alertstate', operator: '=', value: 'firing' }]);
    });

    it('third search has groupBy folder only (no regular filters)', () => {
      const third = getTriagePredefinedSearches()[2];
      const params = new URLSearchParams(third.query);
      // groupBy is now in var-filters as grafana_folder|groupBy
      expect(params.getAll('var-filters')).toContain('grafana_folder|groupBy');
      expect(params.has('var-groupBy')).toBe(false);
      applyTriageSavedSearchState(scene, third.query);

      expect(variable.state.filters).toMatchObject([{ key: 'grafana_folder', operator: 'groupBy', value: '' }]);
    });

    it('default predefined search is folder-firing (firing, grouped by folder)', () => {
      expect(TRIAGE_DEFAULT_PREDEFINED_SEARCH_ID).toBe('triage-predefined-folder-firing');
      const searches = getTriagePredefinedSearches();
      const defaultSearch = searches.find((s) => s.id === TRIAGE_DEFAULT_PREDEFINED_SEARCH_ID);
      expect(defaultSearch).toBeDefined();
      expect(defaultSearch!.isDefault).toBe(true);
      const params = new URLSearchParams(defaultSearch!.query);
      expect(params.getAll('var-filters')).toContain('grafana_folder|groupBy');
      expect(params.has('var-groupBy')).toBe(false);
      applyTriageSavedSearchState(scene, defaultSearch!.query);

      expect(variable.state.filters).toMatchObject([
        { key: 'alertstate', operator: '=', value: 'firing' },
        { key: 'grafana_folder', operator: 'groupBy', value: '' },
      ]);
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
