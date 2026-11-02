import { parse } from '../rule-search/parser';
import { createEmptyFilter } from '../rule-search/sharedRuleFilter';

import { type RecordingRuleFilter, recordingRuleSearchSchema } from './recordingRuleFilters';

interface Row {
  name: string;
  query: string;
  filter: Partial<RecordingRuleFilter>;
}

describe('the Recording rules search', () => {
  it.each<Row>([
    { name: 'a metric', query: 'metric:cpu', filter: { metric: 'cpu' } },
    { name: 'a target data source', query: 'targetDatasource:ds-2', filter: { targetDataSourceUid: 'ds-2' } },
    { name: 'health:ok', query: 'health:ok', filter: { health: 'ok' } },
    { name: "the Alert rules page's keys as title text", query: 'state:firing', filter: { text: ['state:firing'] } },
  ])('reads $name', ({ query, filter }) => {
    expect(parse(query, recordingRuleSearchSchema).filter).toEqual({ ...createEmptyFilter(), ...filter });
  });

  it.each([
    ['metric:cpu_*', 'metric'],
    ['targetDatasource:t*', 'targetDatasource'],
  ])('reports %j as an invalid %s filter', (query, key) => {
    expect(parse(query, recordingRuleSearchSchema).issues).toEqual([{ key, reason: 'invalid' }]);
  });
});
