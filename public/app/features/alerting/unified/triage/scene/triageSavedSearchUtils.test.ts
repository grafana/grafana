import { dateTime } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  EmbeddedScene,
  SceneFlexLayout,
  SceneTimeRange,
  SceneVariableSet,
} from '@grafana/scenes';

import {
  applySavedSearch,
  applyTriageSavedSearchState,
  buildTriageQueryStringFromParts,
  generateTriageUrl,
  mergeTriageSavedSearches,
  serializeCurrentSearchState,
  serializeTriageState,
} from './triageSavedSearchUtils';

// Mock locationService
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    push: jest.fn(),
    getSearch: jest.fn(() => new URLSearchParams()),
  },
}));

describe('triageSavedSearchUtils', () => {
  // Store original window.location
  const originalLocation = window.location;
  const mockGetSearch = locationService.getSearch as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset URL for each test
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost:3000/alerting/alerts' },
      writable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  describe('buildTriageQueryStringFromParts', () => {
    it('builds query string with string time range', () => {
      const result = buildTriageQueryStringFromParts({
        filters: [{ key: 'alertstate', operator: '=', value: 'firing' }],
        groupBy: ['grafana_folder'],
        timeRange: { from: 'now-1h', to: 'now' },
      });
      const params = new URLSearchParams(result);
      expect(params.get('from')).toBe('now-1h');
      expect(params.get('to')).toBe('now');
      // groupBy is encoded inside var-filters as key|groupBy
      expect(params.getAll('var-filters')).toContain('grafana_folder|groupBy');
      expect(params.has('var-groupBy')).toBe(false);
    });

    it('builds query string with DateTime time range', () => {
      const fromDateTime = dateTime('2025-01-15T10:00:00Z');
      const toDateTime = dateTime('2025-01-15T11:00:00Z');
      const result = buildTriageQueryStringFromParts({
        groupBy: [],
        timeRange: { from: fromDateTime, to: toDateTime },
      });
      const params = new URLSearchParams(result);
      expect(params.get('from')).toBe('2025-01-15T10:00:00.000Z');
      expect(params.get('to')).toBe('2025-01-15T11:00:00.000Z');
    });

    it('handles empty filters and groupBy', () => {
      const result = buildTriageQueryStringFromParts({
        groupBy: [],
        timeRange: { from: 'now-4h', to: 'now' },
      });
      const params = new URLSearchParams(result);
      expect(params.get('from')).toBe('now-4h');
      expect(params.get('to')).toBe('now');
      expect(params.has('var-filters')).toBe(false);
      expect(params.has('var-groupBy')).toBe(false);
    });
  });

  describe('triage saved search state', () => {
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

    it.each([
      { operator: '=', encodedOperator: '=', values: undefined },
      { operator: '=|', encodedOperator: '=__gfp__', values: ['Ops,Support#1|EU'] },
    ])('preserves literal commas and hashes in legacy $operator filters', ({ operator, encodedOperator, values }) => {
      const query = new URLSearchParams([
        ['var-filters', `teams|${encodedOperator}|Ops,Support#1__gfp__EU`],
        ['var-groupBy', 'environment'],
        ['from', 'now-7d'],
        ['to', 'now'],
      ]).toString();

      applyTriageSavedSearchState(scene, query);

      expect(variable.state.filters).toMatchObject([
        { key: 'teams', operator, value: 'Ops,Support#1|EU', values },
        { key: 'environment', operator: 'groupBy', value: '' },
      ]);
    });

    it('marks newly saved searches as Scenes format', () => {
      const query = serializeTriageState(variable, { from: 'now-7d', to: 'now' });

      expect(new URLSearchParams(query).get('savedSearchVersion')).toBe('2');
    });

    it('restores a saved one-of filter with its values and grouping', () => {
      const query = new URLSearchParams([
        ['var-filters', 'alertstate|=|firing'],
        ['var-filters', 'teams|=__gfp__|Spryker Cloud Operations'],
        ['var-filters', 'environment|groupBy'],
        ['from', 'now-7d'],
        ['to', 'now'],
      ]).toString();

      applyTriageSavedSearchState(scene, query);

      expect(variable.state.filters).toMatchObject([
        { key: 'alertstate', operator: '=', value: 'firing' },
        {
          key: 'teams',
          operator: '=|',
          value: 'Spryker Cloud Operations',
          values: ['Spryker Cloud Operations'],
        },
        { key: 'environment', operator: 'groupBy', value: '' },
      ]);
      expect(variable.urlSync!.getUrlState()['var-filters']).toEqual([
        'alertstate|=|firing',
        'teams|=__gfp__|Spryker Cloud Operations',
        'environment|groupBy',
      ]);
    });

    it.each([
      { operator: '=|', encodedOperator: '=__gfp__' },
      { operator: '!=|', encodedOperator: '!=__gfp__' },
    ])(
      'round-trips $operator filters with multiple values, labels and escaped delimiters',
      ({ operator, encodedOperator }) => {
        variable.updateFilters([
          {
            key: 'teams',
            keyLabel: 'Team',
            operator,
            value: 'Cloud|Ops',
            values: ['Cloud|Ops', 'Apps,Support#1'],
            valueLabels: ['Cloud operations', 'Application support'],
          },
          { key: 'environment', operator: 'groupBy', value: '' },
        ]);

        const query = serializeTriageState(variable, {
          from: dateTime('2026-11-01T00:00:00Z'),
          to: dateTime('2026-11-08T00:00:00Z'),
        });
        const params = new URLSearchParams(query);
        expect(params.getAll('var-filters')).toEqual([
          `teams,Team|${encodedOperator}|Cloud__gfp__Ops,Cloud operations|Apps__gfc__Support__gfh__1,Application support`,
          'environment|groupBy',
        ]);
        expect(params.get('from')).toBe('2026-11-01T00:00:00.000Z');
        expect(params.get('to')).toBe('2026-11-08T00:00:00.000Z');
        variable.updateFilters([]);

        applyTriageSavedSearchState(scene, query);

        expect(variable.state.filters).toMatchObject([
          {
            key: 'teams',
            keyLabel: 'Team',
            operator,
            value: 'Cloud|Ops',
            values: ['Cloud|Ops', 'Apps,Support#1'],
            valueLabels: ['Cloud operations', 'Application support'],
          },
          { key: 'environment', operator: 'groupBy', value: '' },
        ]);
        expect(scene.state.$timeRange!.state.value.from.toISOString()).toBe('2026-11-01T00:00:00.000Z');
        expect(scene.state.$timeRange!.state.value.to.toISOString()).toBe('2026-11-08T00:00:00.000Z');
      }
    );

    it.each(['', 'var-filters='])('clears previous filters and grouping when applying %j', (query) => {
      variable.updateFilters([
        { key: 'teams', operator: '=|', value: 'Operations', values: ['Operations'] },
        { key: 'environment', operator: 'groupBy', value: '' },
      ]);

      applyTriageSavedSearchState(scene, query);

      expect(variable.state.filters).toEqual([]);
    });

    it('applies a predefined search without retaining previous grouping', () => {
      variable.updateFilters([{ key: 'environment', operator: 'groupBy', value: '' }]);

      applyTriageSavedSearchState(scene, 'var-filters=alertstate%7C%3D%7Cfiring&from=now-15m&to=now');

      expect(variable.state.filters).toMatchObject([{ key: 'alertstate', operator: '=', value: 'firing' }]);
    });

    it('restores single-value filters with inequality and escaped regex alternation', () => {
      const query = new URLSearchParams([
        ['var-filters', 'alertname|=|HighCPU'],
        ['var-filters', 'severity|!=|warning'],
        ['var-filters', 'environment|=~|production__gfp__staging'],
      ]).toString();

      applyTriageSavedSearchState(scene, query);

      expect(variable.state.filters).toMatchObject([
        { key: 'alertname', operator: '=', value: 'HighCPU' },
        { key: 'severity', operator: '!=', value: 'warning' },
        { key: 'environment', operator: '=~', value: 'production|staging' },
      ]);
    });

    it('combines legacy grouping with multi-value filters and unified grouping', () => {
      const query = new URLSearchParams([
        ['var-filters', 'teams|=__gfp__|Operations|Support'],
        ['var-filters', 'alertname|groupBy'],
        ['var-groupBy', 'environment'],
        ['var-groupBy', ''],
      ]).toString();

      applyTriageSavedSearchState(scene, query);

      expect(variable.state.filters).toMatchObject([
        { key: 'teams', operator: '=|', value: 'Operations', values: ['Operations', 'Support'] },
        { key: 'alertname', operator: 'groupBy', value: '' },
        { key: 'environment', operator: 'groupBy', value: '' },
      ]);
    });
  });

  describe('generateTriageUrl', () => {
    it('converts legacy delimiters and grouping when generating a saved search link', () => {
      const query = new URLSearchParams([
        ['var-filters', 'teams|=|Ops,Support#1__gfp__EU'],
        ['var-groupBy', 'environment'],
        ['from', 'now-7d'],
        ['to', 'now'],
      ]).toString();

      expect(generateTriageUrl(query)).toBe(
        '/alerting/alerts?var-filters=teams%7C%3D%7COps__gfc__Support__gfh__1__gfp__EU&var-filters=environment%7CgroupBy&from=now-7d&to=now'
      );
    });

    it('preserves Scenes labels and origin metadata while removing the saved search format marker', () => {
      const query = new URLSearchParams([
        ['var-filters', 'teams,Team|=__gfp__|Ops,Operations|Support,Customer support#scope#restorable'],
        ['savedSearchVersion', '2'],
      ]).toString();

      expect(generateTriageUrl(query)).toBe(
        '/alerting/alerts?var-filters=teams%2CTeam%7C%3D__gfp__%7COps%2COperations%7CSupport%2CCustomer+support%23scope%23restorable'
      );
    });

    it('should generate URL with query', () => {
      const query = 'var-filters=test&var-filters=grafana_folder%7CgroupBy';
      expect(generateTriageUrl(query)).toBe('/alerting/alerts?var-filters=test&var-filters=grafana_folder%7CgroupBy');
    });

    it('should return base path for empty query', () => {
      expect(generateTriageUrl('')).toBe('/alerting/alerts');
    });

    it('should use custom base path', () => {
      const query = 'var-filters=test';
      expect(generateTriageUrl(query, '/custom/path')).toBe('/custom/path?var-filters=test');
    });
  });

  describe('serializeCurrentState', () => {
    it('should serialize var-filters and time range params', () => {
      const params = new URLSearchParams(
        'var-filters=alertname%7C%3D%7Ctest&var-filters=grafana_folder%7CgroupBy&from=now-1h&to=now'
      );
      mockGetSearch.mockReturnValueOnce(params);

      const result = serializeCurrentSearchState();
      expect(result).toContain('var-filters=');
      expect(result).toContain('from=now-1h');
      expect(result).toContain('to=now');
      // groupBy is in var-filters, not var-groupBy
      expect(result).not.toContain('var-groupBy');
    });

    it('should handle multiple var-filters', () => {
      const params = new URLSearchParams('var-filters=a&var-filters=b');
      mockGetSearch.mockReturnValueOnce(params);

      const result = serializeCurrentSearchState();
      const resultParams = new URLSearchParams(result);
      expect(resultParams.getAll('var-filters')).toEqual(['a', 'b']);
    });

    it('should return empty string when no relevant params', () => {
      const params = new URLSearchParams();
      mockGetSearch.mockReturnValueOnce(params);

      const result = serializeCurrentSearchState();
      expect(result).toBe('');
    });

    it('should ignore non-triage params and legacy var-groupBy', () => {
      const params = new URLSearchParams('unrelated=param&var-groupBy=severity');
      mockGetSearch.mockReturnValueOnce(params);

      const result = serializeCurrentSearchState();
      // var-groupBy is no longer in TRIAGE_STATE_URL_PARAMS; groupBy now lives in var-filters
      expect(result).toBe('');
      expect(result).not.toContain('unrelated');
    });
  });

  describe('mergeTriageSavedSearches', () => {
    const mkSearch = (id: string, name: string, isDefault = false) => ({
      id,
      name,
      query: `query-${id}`,
      isDefault,
    });

    it('returns predefined then user when no default', () => {
      const predefined = [mkSearch('p1', 'Predefined 1'), mkSearch('p2', 'Predefined 2')];
      const user = [mkSearch('u1', 'User 1')];
      const result = mergeTriageSavedSearches(predefined, user, null);
      expect(result.map((s) => s.id)).toEqual(['p1', 'p2', 'u1']);
    });

    it('puts default first when it is in predefined', () => {
      const predefined = [
        mkSearch('p1', 'Predefined 1'),
        mkSearch('p2', 'Predefined 2', true),
        mkSearch('p3', 'Predefined 3'),
      ];
      const user = [mkSearch('u1', 'User 1')];
      const result = mergeTriageSavedSearches(predefined, user, 'p2');
      expect(result.map((s) => s.id)).toEqual(['p2', 'p1', 'p3', 'u1']);
    });

    it('puts default first when it is in user saves', () => {
      const predefined = [mkSearch('p1', 'Predefined 1')];
      const user = [mkSearch('u1', 'User 1'), mkSearch('u2', 'User 2'), mkSearch('u3', 'User 3')];
      const result = mergeTriageSavedSearches(predefined, user, 'u2');
      expect(result.map((s) => s.id)).toEqual(['u2', 'p1', 'u1', 'u3']);
    });

    it('returns merged order when default is already first (index 0)', () => {
      const predefined = [mkSearch('p1', 'Predefined 1', true), mkSearch('p2', 'Predefined 2')];
      const user = [mkSearch('u1', 'User 1')];
      const result = mergeTriageSavedSearches(predefined, user, 'p1');
      expect(result.map((s) => s.id)).toEqual(['p1', 'p2', 'u1']);
    });

    it('handles empty predefined', () => {
      const user = [mkSearch('u1', 'User 1'), mkSearch('u2', 'User 2')];
      const result = mergeTriageSavedSearches([], user, 'u2');
      expect(result.map((s) => s.id)).toEqual(['u2', 'u1']);
    });

    it('handles empty user', () => {
      const predefined = [mkSearch('p1', 'Predefined 1'), mkSearch('p2', 'Predefined 2')];
      const result = mergeTriageSavedSearches(predefined, [], 'p2');
      expect(result.map((s) => s.id)).toEqual(['p2', 'p1']);
    });
  });

  describe('applySavedSearch', () => {
    it('converts legacy delimiters and grouping before default-search navigation', () => {
      const query = new URLSearchParams([
        ['var-filters', 'teams|=|Ops,Support#1'],
        ['var-groupBy', 'environment'],
      ]).toString();

      applySavedSearch(query);

      expect(locationService.push).toHaveBeenCalledWith(
        '/alerting/alerts?var-filters=teams%7C%3D%7COps__gfc__Support__gfh__1&var-filters=environment%7CgroupBy'
      );
    });

    it('should call locationService.push with saved search params', () => {
      const query = 'var-filters=alertname%7C%3D%7Ctest&var-filters=grafana_folder%7CgroupBy&from=now-1h&to=now';

      applySavedSearch(query);

      expect(locationService.push).toHaveBeenCalledWith(`/alerting/alerts?${query}`);
    });

    it('should handle empty query by navigating to base path', () => {
      applySavedSearch('');

      expect(locationService.push).toHaveBeenCalledWith('/alerting/alerts');
    });

    it('should handle multiple var-filters', () => {
      const query = 'var-filters=a&var-filters=b&var-filters=c';

      applySavedSearch(query);

      expect(locationService.push).toHaveBeenCalledWith(`/alerting/alerts?${query}`);
    });
  });
});
