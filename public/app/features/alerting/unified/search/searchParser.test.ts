import { PromAlertingRuleState, PromRuleType } from '../../../../types/unified-alerting-dto';

import { applySearchFilterToQuery, getSearchFilterFromQuery, SearchFilterState } from './searchParser';

describe('Alert rules searchParser', () => {
  describe('getSearchFilterFromQuery', () => {
    it.each(['ds:prometheus', 'datasource:prometheus'])('should parse data source filter from %s', (query) => {
      const filter = getSearchFilterFromQuery(query);
      expect(filter.dataSourceName).toBe('prometheus');
    });

    it.each(['ns:integrations-node', 'namespace:integrations-node'])(
      'should parse namespace filter from %s',
      (query) => {
        const filter = getSearchFilterFromQuery(query);
        expect(filter.namespace).toBe('integrations-node');
      }
    );

    it.each(['l:team l:region=emea', 'label:team label:region=emea'])('should parse label filter from %s', (query) => {
      const filter = getSearchFilterFromQuery(query);
      expect(filter.labels).toHaveLength(2);
      expect(filter.labels).toContain('team');
      expect(filter.labels).toContain('region=emea');
    });

    it.each(['g:cpu-utilization', 'group:cpu-utilization'])('should parse group filter from %s', (query) => {
      const filter = getSearchFilterFromQuery(query);
      expect(filter.groupName).toBe('cpu-utilization');
    });

    it.each(['r:cpu-80%-alert', 'rule:cpu-80%-alert'])('should parse rule name filter from %s', (query) => {
      const filter = getSearchFilterFromQuery(query);
      expect(filter.ruleName).toBe('cpu-80%-alert');
    });

    it.each(['s:firing', 'state:firing'])('should parse rule state filter from %s', (query) => {
      const filter = getSearchFilterFromQuery(query);
      expect(filter.ruleState).toBe(PromAlertingRuleState.Firing);
    });

    it.each(['t:recording', 'type:recording'])('should parse rule type filter from %s', (query) => {
      const filter = getSearchFilterFromQuery(query);
      expect(filter.ruleType).toBe(PromRuleType.Recording);
    });

    it('should parse non-filtering words as free form query', () => {
      const filter = getSearchFilterFromQuery('cpu usage rule');
      expect(filter.freeFormWords).toHaveLength(3);
      expect(filter.freeFormWords).toContain('cpu');
      expect(filter.freeFormWords).toContain('usage');
      expect(filter.freeFormWords).toContain('rule');
    });

    it('should parse filter values with whitespaces when in quotes', () => {
      const query = 'ds:"prom dev" ns:"node one" l:"team=frontend us" g:"cpu alerts" r:"cpu failure"';
      const filter = getSearchFilterFromQuery(query);

      expect(filter.dataSourceName).toBe('prom dev');
      expect(filter.namespace).toBe('node one');
      expect(filter.labels).toContain('team=frontend us');
      expect(filter.groupName).toContain('cpu alerts');
      expect(filter.ruleName).toContain('cpu failure');
    });

    it('should parse filter values with special characters', () => {
      const query =
        'ds:prom::dev/linux>>; ns:"[{node}] (#20+)" l:_region=apac|emea\\nasa g:$20.00%$ r:"cpu!! & memory.,?"';
      const filter = getSearchFilterFromQuery(query);

      expect(filter.dataSourceName).toBe('prom::dev/linux>>;');
      expect(filter.namespace).toBe('[{node}] (#20+)');
      expect(filter.labels).toContain('_region=apac|emea\\nasa');
      expect(filter.groupName).toContain('$20.00%$');
      expect(filter.ruleName).toContain('cpu!! & memory.,?');
    });

    it('should parse non-filter terms with colon as free form words', () => {
      const query = 'cpu:high-utilization memory:overload';
      const filter = getSearchFilterFromQuery(query);

      expect(filter.freeFormWords).toContain('cpu:high-utilization');
      expect(filter.freeFormWords).toContain('memory:overload');
    });

    it('should parse mixed free form words and filters', () => {
      const query = 'ds:prometheus utilization l:team cpu';
      const filter = getSearchFilterFromQuery(query);

      expect(filter.dataSourceName).toBe('prometheus');
      expect(filter.labels).toContain('team');
      expect(filter.freeFormWords).toContain('utilization');
      expect(filter.freeFormWords).toContain('cpu');
    });
  });

  describe('applySearchFilterToQuery', () => {
    it('should apply filters to an empty query', () => {
      const filter = getFilter({
        freeFormWords: ['cpu', 'eighty'],
        dataSourceName: 'Mimir Dev',
        namespace: '/etc/prometheus',
        labels: ['team', 'region=apac'],
        groupName: 'cpu-usage',
        ruleName: 'cpu > 80%',
        ruleType: PromRuleType.Alerting,
        ruleState: PromAlertingRuleState.Firing,
      });

      const query = applySearchFilterToQuery('', filter);

      expect(query).toBe(
        'ds:"Mimir Dev" ns:/etc/prometheus g:cpu-usage r:"cpu > 80%" s:firing t:alerting l:team l:region=apac cpu eighty'
      );
    });

    it('should update filters in existing query', () => {
      const filter = getFilter({
        dataSourceName: 'Mimir Dev',
        namespace: '/etc/prometheus',
        labels: ['team', 'region=apac'],
        groupName: 'cpu-usage',
        ruleName: 'cpu > 80%',
      });

      const baseQuery = 'ds:prometheus ns:mimir-global g:memory r:"mem > 90% l:severity"';
      const query = applySearchFilterToQuery(baseQuery, filter);

      expect(query).toBe('ds:"Mimir Dev" ns:/etc/prometheus g:cpu-usage r:"cpu > 80%" l:team l:region=apac');
    });

    it('should preserve the order of parameters when updating', () => {
      const filter = getFilter({
        dataSourceName: 'Mimir Dev',
        namespace: '/etc/prometheus',
        labels: ['region=emea'],
        groupName: 'cpu-usage',
        ruleName: 'cpu > 80%',
      });

      const baseQuery = 'l:region=apac r:"mem > 90%" g:memory ns:mimir-global ds:prometheus';
      const query = applySearchFilterToQuery(baseQuery, filter);

      expect(query).toBe('l:region=emea r:"cpu > 80%" g:cpu-usage ns:/etc/prometheus ds:"Mimir Dev"');
    });
  });
});

function getFilter(filter: Partial<SearchFilterState>): SearchFilterState {
  return {
    freeFormWords: [],
    labels: [],
    ...filter,
  };
}
