import { defaultDataQueryKind, PanelQueryKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { ensureUniqueRefIds, getRuntimePanelDataSource } from './utils';

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
