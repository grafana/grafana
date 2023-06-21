import { PromAlertingRuleState, PromRuleType } from '../../../../types/unified-alerting-dto';
import { getFilter } from '../utils/search';

import { applySearchFilterToQuery, getSearchFilterFromQuery, RuleHealth } from './rulesSearchParser';

describe('Alert rules searchParser', () => {
  describe('getSearchFilterFromQuery', () => {
    it.each(['datasource:prometheus'])('should parse data source filter from "%s" query', (query) => {
      const filter = getSearchFilterFromQuery(query);
      expect(filter.dataSourceNames).toEqual(['prometheus']);
    });

    it.each(['namespace:integrations-node'])('should parse namespace filter from "%s" query', (query) => {
      const filter = getSearchFilterFromQuery(query);
      expect(filter.namespace).toBe('integrations-node');
    });

    it.each(['label:team label:region=emea'])('should parse label filter from "%s" query', (query) => {
      const filter = getSearchFilterFromQuery(query);
      expect(filter.labels).toHaveLength(2);
      expect(filter.labels).toContain('team');
      expect(filter.labels).toContain('region=emea');
    });

    it.each(['group:cpu-utilization'])('should parse group filter from "%s" query', (query) => {
      const filter = getSearchFilterFromQuery(query);
      expect(filter.groupName).toBe('cpu-utilization');
    });

    it.each(['rule:cpu-80%-alert'])('should parse rule name filter from "%s" query', (query) => {
      const filter = getSearchFilterFromQuery(query);
      expect(filter.ruleName).toBe('cpu-80%-alert');
    });

    it.each([
      { query: 'state:firing', expectedFilter: PromAlertingRuleState.Firing },
      { query: 'state:inactive', expectedFilter: PromAlertingRuleState.Inactive },
      { query: 'state:normal', expectedFilter: PromAlertingRuleState.Inactive },
      { query: 'state:pending', expectedFilter: PromAlertingRuleState.Pending },
    ])('should parse $expectedFilter rule state filter from "$query" query', ({ query, expectedFilter }) => {
      const filter = getSearchFilterFromQuery(query);
      expect(filter.ruleState).toBe(expectedFilter);
    });

    it.each([
      { query: 'type:alerting', expectedFilter: PromRuleType.Alerting },
      { query: 'type:recording', expectedFilter: PromRuleType.Recording },
    ])('should parse $expectedFilter rule type filter from "$query" input', ({ query, expectedFilter }) => {
      const filter = getSearchFilterFromQuery(query);
      expect(filter.ruleType).toBe(expectedFilter);
    });

    it.each([
      { query: 'health:ok', expectedFilter: RuleHealth.Ok },
      { query: 'health:nodata', expectedFilter: RuleHealth.NoData },
      { query: 'health:error', expectedFilter: RuleHealth.Error },
    ])('should parse RuleHealth $expectedFilter filter from "$query" query', ({ query, expectedFilter }) => {
      const filter = getSearchFilterFromQuery(query);
      expect(filter.ruleHealth).toBe(expectedFilter);
    });

    it('should parse non-filtering words as free form query', () => {
      const filter = getSearchFilterFromQuery('cpu usage rule');
      expect(filter.freeFormWords).toHaveLength(3);
      expect(filter.freeFormWords).toContain('cpu');
      expect(filter.freeFormWords).toContain('usage');
      expect(filter.freeFormWords).toContain('rule');
    });

    it('should parse free words with quotes', () => {
      const query = '"hello world" hello world';
      const filter = getSearchFilterFromQuery(query);

      expect(filter.freeFormWords).toEqual(['hello world', 'hello', 'world']);
    });

    it('should parse filter values with whitespaces when in quotes', () => {
      const query =
        'datasource:"prom dev" namespace:"node one" label:"team=frontend us" group:"cpu alerts" rule:"cpu failure"';
      const filter = getSearchFilterFromQuery(query);

      expect(filter.dataSourceNames).toEqual(['prom dev']);
      expect(filter.namespace).toBe('node one');
      expect(filter.labels).toContain('team=frontend us');
      expect(filter.groupName).toContain('cpu alerts');
      expect(filter.ruleName).toContain('cpu failure');
    });

    it('should parse filter values with special characters', () => {
      const query =
        'datasource:prom::dev/linux>>; namespace:"[{node}] (#20+)" label:_region=apac|emea\\nasa group:$20.00%$ rule:"cpu!! & memory.,?"';
      const filter = getSearchFilterFromQuery(query);

      expect(filter.dataSourceNames).toEqual(['prom::dev/linux>>;']);
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
      const query = 'datasource:prometheus utilization label:team cpu';
      const filter = getSearchFilterFromQuery(query);

      expect(filter.dataSourceNames).toEqual(['prometheus']);
      expect(filter.labels).toContain('team');
      expect(filter.freeFormWords).toContain('utilization');
      expect(filter.freeFormWords).toContain('cpu');
    });

    it('should parse labels containing matchers', () => {
      const query = 'label:region!=US label:"team=~fe.*devs" label:cluster!~ba.+';
      const filter = getSearchFilterFromQuery(query);

      expect(filter.labels).toContain('region!=US');
      expect(filter.labels).toContain('team=~fe.*devs');
      expect(filter.labels).toContain('cluster!~ba.+');
    });
  });

  describe('applySearchFilterToQuery', () => {
    it('should apply filters to an empty query', () => {
      const filter = getFilter({
        freeFormWords: ['cpu', 'eighty'],
        dataSourceNames: ['Mimir Dev'],
        namespace: '/etc/prometheus',
        labels: ['team', 'region=apac'],
        groupName: 'cpu-usage',
        ruleName: 'cpu > 80%',
        ruleType: PromRuleType.Alerting,
        ruleState: PromAlertingRuleState.Firing,
        ruleHealth: RuleHealth.Ok,
      });

      const query = applySearchFilterToQuery('', filter);

      expect(query).toBe(
        'datasource:"Mimir Dev" namespace:/etc/prometheus group:cpu-usage rule:"cpu > 80%" state:firing type:alerting health:ok label:team label:region=apac cpu eighty'
      );
    });

    it('should update filters in existing query', () => {
      const filter = getFilter({
        dataSourceNames: ['Mimir Dev'],
        namespace: '/etc/prometheus',
        labels: ['team', 'region=apac'],
        groupName: 'cpu-usage',
        ruleName: 'cpu > 80%',
      });

      const baseQuery = 'datasource:prometheus namespace:mimir-global group:memory rule:"mem > 90% label:severity"';
      const query = applySearchFilterToQuery(baseQuery, filter);

      expect(query).toBe(
        'datasource:"Mimir Dev" namespace:/etc/prometheus group:cpu-usage rule:"cpu > 80%" label:team label:region=apac'
      );
    });

    it('should preserve the order of parameters when updating', () => {
      const filter = getFilter({
        dataSourceNames: ['Mimir Dev'],
        namespace: '/etc/prometheus',
        labels: ['region=emea'],
        groupName: 'cpu-usage',
        ruleName: 'cpu > 80%',
      });

      const baseQuery = 'label:region=apac rule:"mem > 90%" group:memory namespace:mimir-global datasource:prometheus';
      const query = applySearchFilterToQuery(baseQuery, filter);

      expect(query).toBe(
        'label:region=emea rule:"cpu > 80%" group:cpu-usage namespace:/etc/prometheus datasource:"Mimir Dev"'
      );
    });
  });
});
