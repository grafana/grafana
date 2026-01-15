import {
  defaultDataQueryKind,
  defaultPanelSpec,
  PanelKind,
  PanelQueryKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { ensureUniqueRefIds, getPanelDataSource, getRuntimePanelDataSource } from './utils';

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
