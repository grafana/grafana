import { PromAlertingRuleState, PromRuleType } from '../../../../types/unified-alerting-dto';

import { getSearchFilterFromQuery } from './searchParser';

describe('Alert rules searchParser', function () {
  describe('getSearchFilterFromQuery', function () {
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
  });
});
