import {
  defaultDataQueryKind,
  defaultPanelSpec,
  type PanelKind,
  type PanelQueryKind,
  type QueryOptionsSpec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { PanelTimeRange } from '../../scene/panel-timerange/PanelTimeRange';

import { buildVizPanel, ensureUniqueRefIds, getPanelDataSource, getRuntimePanelDataSource } from './utils';

describe('getRuntimePanelDataSource', () => {
  it('should return uid and type when explicit datasource UID is provided', () => {
    const query: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        hidden: false,
        query: {
          kind: 'DataQuery',
          version: defaultDataQueryKind().version,
          group: 'prometheus',
          datasource: {
            name: 'prometheus-uid',
          },
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query.spec.query);

    expect(result).toEqual({
      uid: 'prometheus-uid',
      type: 'prometheus',
    });
  });

  it('should return type-only when only group is provided (no explicit UID)', () => {
    const query: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        hidden: false,
        query: {
          kind: 'DataQuery',
          version: defaultDataQueryKind().version,
          group: 'prometheus',
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query.spec.query);

    expect(result).toEqual({
      type: 'prometheus',
    });
  });

  it('should return type-only for different datasource types when no UID provided', () => {
    const query: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        hidden: false,
        query: {
          kind: 'DataQuery',
          version: defaultDataQueryKind().version,
          group: 'loki',
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query.spec.query);

    expect(result).toEqual({
      type: 'loki',
    });
  });

  it('should return type-only even for unknown datasource types', () => {
    const query: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        hidden: false,
        query: {
          kind: 'DataQuery',
          version: defaultDataQueryKind().version,
          group: 'unknown-type',
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query.spec.query);

    expect(result).toEqual({
      type: 'unknown-type',
    });
  });

  it('should return type-only when datasource name is empty string', () => {
    const query: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        hidden: false,
        query: {
          kind: 'DataQuery',
          version: defaultDataQueryKind().version,
          group: 'prometheus',
          datasource: {
            name: '',
          },
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query.spec.query);

    expect(result).toEqual({
      type: 'prometheus',
    });
  });

  it('should return undefined when neither group nor datasource is provided', () => {
    const query: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        hidden: false,
        query: {
          kind: 'DataQuery',
          version: defaultDataQueryKind().version,
          group: '',
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query.spec.query);

    expect(result).toBeUndefined();
  });
});

describe('getPanelDataSource', () => {
  const createPanelWithQueries = (queries: PanelQueryKind[]): PanelKind => ({
    kind: 'Panel',
    spec: {
      ...defaultPanelSpec(),
      id: 1,
      title: 'Test Panel',
      data: {
        kind: 'QueryGroup',
        spec: {
          queries,
          queryOptions: {},
          transformations: [],
        },
      },
    },
  });

  const createQuery = (datasourceName: string, group: string, refId = 'A'): PanelQueryKind => ({
    kind: 'PanelQuery',
    spec: {
      refId,
      hidden: false,
      query: {
        kind: 'DataQuery',
        version: defaultDataQueryKind().version,
        group,
        datasource: {
          name: datasourceName,
        },
        spec: {},
      },
    },
  });

  const createQueryWithoutDatasourceName = (group: string, refId = 'A'): PanelQueryKind => ({
    kind: 'PanelQuery',
    spec: {
      refId,
      hidden: false,
      query: {
        kind: 'DataQuery',
        version: defaultDataQueryKind().version,
        group,
        spec: {},
      },
    },
  });

  it('should return undefined when panel has no queries', () => {
    const panel = createPanelWithQueries([]);

    const result = getPanelDataSource(panel);

    expect(result).toBeUndefined();
  });

  it('should return undefined for a single query with specific datasource (not mixed)', () => {
    const panel = createPanelWithQueries([createQuery('prometheus-uid', 'prometheus')]);

    const result = getPanelDataSource(panel);

    expect(result).toBeUndefined();
  });

  it('should return undefined for multiple queries with the same datasource', () => {
    const panel = createPanelWithQueries([
      createQuery('prometheus-uid', 'prometheus', 'A'),
      createQuery('prometheus-uid', 'prometheus', 'B'),
      createQuery('prometheus-uid', 'prometheus', 'C'),
    ]);

    const result = getPanelDataSource(panel);

    expect(result).toBeUndefined();
  });

  it('should return mixed datasource when queries use different datasource UIDs', () => {
    const panel = createPanelWithQueries([
      createQuery('prometheus-uid', 'prometheus', 'A'),
      createQuery('loki-uid', 'loki', 'B'),
    ]);

    const result = getPanelDataSource(panel);

    expect(result).toEqual({ type: 'mixed', uid: MIXED_DATASOURCE_NAME });
  });

  it('should return mixed datasource when queries use different datasource types', () => {
    const panel = createPanelWithQueries([
      createQuery('ds-uid', 'prometheus', 'A'),
      createQuery('ds-uid', 'loki', 'B'),
    ]);

    const result = getPanelDataSource(panel);

    expect(result).toEqual({ type: 'mixed', uid: MIXED_DATASOURCE_NAME });
  });

  it('should return mixed datasource when multiple queries use Dashboard datasource', () => {
    const panel = createPanelWithQueries([
      createQuery(SHARED_DASHBOARD_QUERY, 'datasource', 'A'),
      createQuery(SHARED_DASHBOARD_QUERY, 'datasource', 'B'),
      createQuery(SHARED_DASHBOARD_QUERY, 'datasource', 'C'),
    ]);

    const result = getPanelDataSource(panel);

    expect(result).toEqual({ type: 'mixed', uid: MIXED_DATASOURCE_NAME });
  });

  it('should return Dashboard datasource when single query uses Dashboard datasource', () => {
    const panel = createPanelWithQueries([createQuery(SHARED_DASHBOARD_QUERY, 'datasource')]);

    const result = getPanelDataSource(panel);

    expect(result).toEqual({ type: 'datasource', uid: SHARED_DASHBOARD_QUERY });
  });

  it('should return mixed when Dashboard datasource is mixed with other datasources', () => {
    const panel = createPanelWithQueries([
      createQuery(SHARED_DASHBOARD_QUERY, 'datasource', 'A'),
      createQuery('prometheus-uid', 'prometheus', 'B'),
    ]);

    const result = getPanelDataSource(panel);

    expect(result).toEqual({ type: 'mixed', uid: MIXED_DATASOURCE_NAME });
  });

  it('should return undefined when queries have no explicit datasource name but same type', () => {
    const panel = createPanelWithQueries([
      createQueryWithoutDatasourceName('prometheus', 'A'),
      createQueryWithoutDatasourceName('prometheus', 'B'),
    ]);

    const result = getPanelDataSource(panel);

    expect(result).toBeUndefined();
  });

  it('should return mixed when queries have no explicit datasource name but different types', () => {
    const panel = createPanelWithQueries([
      createQueryWithoutDatasourceName('prometheus', 'A'),
      createQueryWithoutDatasourceName('loki', 'B'),
    ]);

    const result = getPanelDataSource(panel);

    expect(result).toEqual({ type: 'mixed', uid: MIXED_DATASOURCE_NAME });
  });
});

describe('ensureUniqueRefIds', () => {
  const createQuery = (refId: string): PanelQueryKind => ({
    kind: 'PanelQuery',
    spec: {
      refId,
      hidden: false,
      query: {
        kind: 'DataQuery',
        version: defaultDataQueryKind().version,
        group: 'prometheus',
        spec: {},
      },
    },
  });

  it('should assign unique refIds to queries without refIds', () => {
    const queries: PanelQueryKind[] = [createQuery(''), createQuery(''), createQuery('')];

    const result = ensureUniqueRefIds(queries);

    expect(result[0].spec.refId).toBe('A');
    expect(result[1].spec.refId).toBe('B');
    expect(result[2].spec.refId).toBe('C');
  });

  it('should preserve existing refIds and fill gaps', () => {
    const queries: PanelQueryKind[] = [createQuery('A'), createQuery(''), createQuery('D'), createQuery('')];

    const result = ensureUniqueRefIds(queries);

    expect(result[0].spec.refId).toBe('A');
    expect(result[1].spec.refId).toBe('B');
    expect(result[2].spec.refId).toBe('D');
    expect(result[3].spec.refId).toBe('C');
  });

  it('should handle all queries having existing refIds', () => {
    const queries: PanelQueryKind[] = [createQuery('A'), createQuery('B'), createQuery('C')];

    const result = ensureUniqueRefIds(queries);

    expect(result[0].spec.refId).toBe('A');
    expect(result[1].spec.refId).toBe('B');
    expect(result[2].spec.refId).toBe('C');
  });

  it('should only modify queries without refIds', () => {
    const queries: PanelQueryKind[] = [createQuery('A'), createQuery(''), createQuery('C')];

    const result = ensureUniqueRefIds(queries);

    // Existing refIds should be preserved
    expect(result[0].spec.refId).toBe('A');
    expect(result[2].spec.refId).toBe('C');
    // Missing refId should be assigned
    expect(result[1].spec.refId).toBe('B');
  });

  it('should handle empty array', () => {
    const result = ensureUniqueRefIds([]);

    expect(result).toEqual([]);
  });

  it('should handle single query without refId', () => {
    const queries: PanelQueryKind[] = [createQuery('')];

    const result = ensureUniqueRefIds(queries);

    expect(result[0].spec.refId).toBe('A');
  });
});

describe('buildVizPanel', () => {
  // Pass title='' to test hoverHeader behavior (no title); omit to use the defaultPanelSpec title.
  function buildPanelWithQueryOptions(queryOptions: Partial<QueryOptionsSpec>, title?: string): PanelKind {
    const base = defaultPanelSpec();
    return {
      kind: 'Panel',
      spec: {
        ...base,
        ...(title !== undefined ? { title } : {}),
        data: {
          kind: 'QueryGroup',
          spec: {
            ...base.data.spec,
            queryOptions: { ...base.data.spec.queryOptions, ...queryOptions },
          },
        },
      },
    };
  }

  function getPanelTimeRange(panel: PanelKind): PanelTimeRange {
    const viz = buildVizPanel(panel);
    if (!(viz.state.$timeRange instanceof PanelTimeRange)) {
      throw new Error('$timeRange must be PanelTimeRange');
    }
    return viz.state.$timeRange;
  }

  it.each([
    ['timeCompare', 'compareWith', '1d'],
    ['timeFrom', 'timeFrom', '2h'],
    ['timeShift', 'timeShift', '1h'],
  ] as const)('maps queryOptions.%s to PanelTimeRange %s', (queryOptionsField, stateField, value) => {
    const panelTime = getPanelTimeRange(buildPanelWithQueryOptions({ [queryOptionsField]: value }));

    expect(panelTime.state[stateField]).toBe(value);
  });

  it('carries hideTimeOverride when another time field triggers PanelTimeRange creation', () => {
    const panelTime = getPanelTimeRange(buildPanelWithQueryOptions({ timeFrom: '2h', hideTimeOverride: true }));

    expect(panelTime.state.hideTimeOverride).toBe(true);
  });

  it('maps all four time fields when set together', () => {
    const panelTime = getPanelTimeRange(
      buildPanelWithQueryOptions({
        timeFrom: '2h',
        timeShift: '1h',
        hideTimeOverride: true,
        timeCompare: '1d',
      })
    );

    expect(panelTime.state).toMatchObject({
      timeFrom: '2h',
      timeShift: '1h',
      hideTimeOverride: true,
      compareWith: '1d',
    });
  });

  it('does not create $timeRange when only hideTimeOverride is set', () => {
    // hideTimeOverride alone is not one of the three trigger fields (timeFrom/timeShift/timeCompare).
    const viz = buildVizPanel(buildPanelWithQueryOptions({ hideTimeOverride: true }));

    expect(viz.state.$timeRange).toBeUndefined();
  });

  it('does not create $timeRange when no time fields are set', () => {
    const viz = buildVizPanel(buildPanelWithQueryOptions({}));

    expect(viz.state.$timeRange).toBeUndefined();
  });

  describe('hoverHeader interaction with time range', () => {
    // hoverHeader is shown only when there's no title AND no visible time override.
    // timeOverrideShown = (timeFrom || timeShift) && !hideTimeOverride — note timeCompare is NOT included.

    it('shows hoverHeader when there is no title and no time fields', () => {
      const viz = buildVizPanel(buildPanelWithQueryOptions({}, ''));

      expect(viz.state.hoverHeader).toBe(true);
    });

    it('hides hoverHeader when timeFrom is visible (no hideTimeOverride)', () => {
      const viz = buildVizPanel(buildPanelWithQueryOptions({ timeFrom: '2h' }, ''));

      expect(viz.state.hoverHeader).toBe(false);
    });

    it('hides hoverHeader when timeShift is visible', () => {
      const viz = buildVizPanel(buildPanelWithQueryOptions({ timeShift: '1h' }, ''));

      expect(viz.state.hoverHeader).toBe(false);
    });

    it('shows hoverHeader when timeFrom is set but hideTimeOverride suppresses it', () => {
      const viz = buildVizPanel(buildPanelWithQueryOptions({ timeFrom: '2h', hideTimeOverride: true }, ''));

      expect(viz.state.hoverHeader).toBe(true);
    });

    it('shows hoverHeader when only timeCompare is set (timeCompare is not a visible time override)', () => {
      const viz = buildVizPanel(buildPanelWithQueryOptions({ timeCompare: '1d' }, ''));

      expect(viz.state.hoverHeader).toBe(true);
    });

    it('hides hoverHeader when the panel has a title, regardless of time fields', () => {
      const viz = buildVizPanel(buildPanelWithQueryOptions({ timeFrom: '2h', hideTimeOverride: true }, 'My Panel'));

      expect(viz.state.hoverHeader).toBe(false);
    });
  });
});
