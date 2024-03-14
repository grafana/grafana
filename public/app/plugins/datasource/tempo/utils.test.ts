import { TempoQuery } from './types';
import { migrateFromSearchToTraceQLSearch } from './utils';

describe('utils', () => {
  it('migrateFromSearchToTraceQLSearch correctly updates the query', async () => {
    const query: TempoQuery = {
      refId: 'A',
      filters: [],
      queryType: 'nativeSearch',
      serviceName: 'frontend',
      spanName: 'http.server',
      minDuration: '1s',
      maxDuration: '10s',
      search: 'component="net/http" datasource.type="tempo"',
    };

    const migratedQuery = migrateFromSearchToTraceQLSearch(query);
    expect(migratedQuery.queryType).toBe('traceqlSearch');
    expect(migratedQuery.filters.length).toBe(6);
    expect(migratedQuery.filters[0].scope).toBe('span');
    expect(migratedQuery.filters[0].tag).toBe('name');
    expect(migratedQuery.filters[0].operator).toBe('=');
    expect(migratedQuery.filters[0].value![0]).toBe('http.server');
    expect(migratedQuery.filters[0].valueType).toBe('string');
    expect(migratedQuery.filters[1].scope).toBe('resource');
    expect(migratedQuery.filters[1].tag).toBe('service.name');
    expect(migratedQuery.filters[1].operator).toBe('=');
    expect(migratedQuery.filters[1].value![0]).toBe('frontend');
    expect(migratedQuery.filters[1].valueType).toBe('string');
    expect(migratedQuery.filters[2].tag).toBe('duration');
    expect(migratedQuery.filters[2].operator).toBe('>');
    expect(migratedQuery.filters[2].value![0]).toBe('1s');
    expect(migratedQuery.filters[2].valueType).toBe('duration');
    expect(migratedQuery.filters[3].tag).toBe('duration');
    expect(migratedQuery.filters[3].operator).toBe('<');
    expect(migratedQuery.filters[3].value![0]).toBe('10s');
    expect(migratedQuery.filters[3].valueType).toBe('duration');
    expect(migratedQuery.filters[4].scope).toBe('unscoped');
    expect(migratedQuery.filters[4].tag).toBe('component');
    expect(migratedQuery.filters[4].operator).toBe('=');
    expect(migratedQuery.filters[4].value![0]).toBe('net/http');
    expect(migratedQuery.filters[4].valueType).toBe('string');
    expect(migratedQuery.filters[5].scope).toBe('unscoped');
    expect(migratedQuery.filters[5].tag).toBe('datasource.type');
    expect(migratedQuery.filters[5].operator).toBe('=');
    expect(migratedQuery.filters[5].value![0]).toBe('tempo');
    expect(migratedQuery.filters[5].valueType).toBe('string');
  });
});
