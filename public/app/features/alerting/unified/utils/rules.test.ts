import { PluginLoadingStrategy } from '@grafana/data';
import { config } from '@grafana/runtime';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';

import {
  mockCombinedCloudRuleNamespace,
  mockCombinedRule,
  mockCombinedRuleGroup,
  mockGrafanaRulerRule,
  mockPromAlertingRule,
  mockRuleWithLocation,
  mockRulerAlertingRule,
} from '../mocks';

import { GRAFANA_ORIGIN_LABEL } from './labels';
import { hashQuery, oldhashQuery } from './rule-id';
import {
  getRuleGroupLocationFromCombinedRule,
  getRuleGroupLocationFromRuleWithLocation,
  getRulePluginOrigin,
} from './rules';

describe('getRuleOrigin', () => {
  it('returns undefined when no origin label is present', () => {
    const rule = mockPromAlertingRule({
      labels: {},
    });
    expect(getRulePluginOrigin(rule)).toBeUndefined();
  });

  it('returns undefined when origin label does not match expected format', () => {
    const rule = mockPromAlertingRule({
      labels: { [GRAFANA_ORIGIN_LABEL]: 'invalid_format' },
    });
    expect(getRulePluginOrigin(rule)).toBeUndefined();
  });

  it('returns undefined when plugin is not installed', () => {
    const rule = mockPromAlertingRule({
      labels: { [GRAFANA_ORIGIN_LABEL]: 'plugin/uninstalled_plugin' },
    });
    expect(getRulePluginOrigin(rule)).toBeUndefined();
  });

  it('returns pluginId when origin label matches expected format and plugin is installed', () => {
    config.apps = {
      installed_plugin: {
        id: 'installed_plugin',
        version: '',
        path: '',
        preload: true,
        angular: { detected: false, hideDeprecation: false },
        loadingStrategy: PluginLoadingStrategy.script,
        extensions: {
          addedLinks: [],
          addedComponents: [],
          extensionPoints: [],
          exposedComponents: [],
        },
        dependencies: {
          grafanaVersion: '',
          plugins: [],
          extensions: {
            exposedComponents: [],
          },
        },
      },
    };
    const rule = mockPromAlertingRule({
      labels: { [GRAFANA_ORIGIN_LABEL]: 'plugin/installed_plugin' },
    });
    expect(getRulePluginOrigin(rule)).toEqual({ pluginId: 'installed_plugin' });
  });
});

describe('ruleGroupLocation', () => {
  it('should be able to extract rule group location from a Grafana managed combinedRule', () => {
    const rule = mockCombinedRule({
      group: mockCombinedRuleGroup('group-1', []),
      rulerRule: mockGrafanaRulerRule({ namespace_uid: 'abc123' }),
    });

    const groupLocation = getRuleGroupLocationFromCombinedRule(rule);
    expect(groupLocation).toEqual<RuleGroupIdentifier>({
      dataSourceName: 'grafana',
      namespaceName: 'abc123',
      groupName: 'group-1',
    });
  });

  it('should be able to extract rule group location from a data source managed combinedRule', () => {
    const rule = mockCombinedRule({
      group: mockCombinedRuleGroup('group-1', []),
      namespace: mockCombinedCloudRuleNamespace({ name: 'abc123' }, 'prometheus-1'),
      rulerRule: mockRulerAlertingRule(),
    });

    const groupLocation = getRuleGroupLocationFromCombinedRule(rule);
    expect(groupLocation).toEqual<RuleGroupIdentifier>({
      dataSourceName: 'prometheus-1',
      namespaceName: 'abc123',
      groupName: 'group-1',
    });
  });

  it('should be able to extract rule group location from a Grafana managed ruleWithLocation', () => {
    const rule = mockRuleWithLocation(mockGrafanaRulerRule({ namespace_uid: 'abc123' }));
    const groupLocation = getRuleGroupLocationFromRuleWithLocation(rule);
    expect(groupLocation).toEqual<RuleGroupIdentifier>({
      dataSourceName: 'grafana',
      namespaceName: 'abc123',
      groupName: 'group-1',
    });
  });

  it('should be able to extract rule group location from a data source managed ruleWithLocation', () => {
    const rule = mockRuleWithLocation(mockRulerAlertingRule({}), { namespace: 'abc123' });
    const groupLocation = getRuleGroupLocationFromRuleWithLocation(rule);
    expect(groupLocation).toEqual<RuleGroupIdentifier>({
      dataSourceName: 'grafana',
      namespaceName: 'abc123',
      groupName: 'group-1',
    });
  });
});

describe('hashQuery Performance Comparison', () => {
  const repetitions = 4;
  const length = 200;

  function generateLargeNumberOfQueries(count: number) {
    const queries = [];
    for (let i = 0; i < count; i++) {
      queries.push({
        refId: `A${i}`,
        queryType: '',
        relativeTimeRange: { from: 600 + i * 10, to: i }, // Slightly varying time ranges
        datasourceUid: `DSUID${i}`, // Unique datasource UID
        model: {
          dimensions: {},
          expression: '',
          hide: i % 2 === 0, // Alternating hide values
          intervalMs: 1000 + (i % 5) * 500, // Varying intervals
          matchExact: i % 2 === 0,
          maxDataPoints: 43200 - (i % 100), // Adjusting maxDataPoints
          metricEditorMode: 0,
          metricName: `Metric${i}`, // Unique metric name
          metricQueryType: i % 3, // Rotating through query types
          namespace: `AWS/Service${i % 5}`, // Rotating namespaces
          queryMode: 'Metrics',
          refId: `A${i}`,
          region: i % 2 === 0 ? 'us-east-1' : 'us-west-1', // Alternating regions
          statistic: i % 2 === 0 ? 'Maximum' : 'Average', // Alternating statistics
        },
      });
      queries.push({
        refId: `B${i}`,
        queryType: '',
        relativeTimeRange: { from: i * 10, to: i },
        datasourceUid: `-10${i}`,
        model: {
          conditions: [
            {
              evaluator: { params: [i, i + 1], type: i % 2 === 0 ? 'gt' : 'lt' },
              operator: { type: i % 2 === 0 ? 'and' : 'or' },
              query: { params: [] },
              reducer: { params: [], type: i % 2 === 0 ? 'last' : 'max' },
              type: 'query',
            },
          ],
          datasource: { name: 'Expression', type: '__expr__', uid: '__expr__' },
          hide: i % 3 === 0,
          intervalMs: 1000 + (i % 10) * 100,
          maxDataPoints: 43200 - (i % 50),
          refId: `B${i}`,
          type: 'classic_conditions',
        },
      });
    }
    return queries;
  }

  const largeQueries = generateLargeNumberOfQueries(1000);
  const queries = largeQueries;
  it(`Compare performance for query length ${length}`, () => {
    let totalOriginalTime = 0;
    let totalOptimizedTime = 0;
    // for each rule
    for (let i = 0; i < queries.length; i++) {
      const query = JSON.stringify(queries[i]);
      // original function
      let originalTime = 0;
      for (let i = 0; i < repetitions; i++) {
        // we repeat the test to get a more accurate average time
        const start = performance.now();
        oldhashQuery(query);
        const end = performance.now();
        originalTime += end - start;
      }
      originalTime /= repetitions;
      totalOriginalTime += originalTime;

      // optimized function
      let optimizedTime = 0;
      for (let i = 0; i < repetitions; i++) {
        const start = performance.now();
        hashQuery(query);
        const end = performance.now();
        optimizedTime += end - start;
      }
      optimizedTime /= repetitions;
      totalOptimizedTime += optimizedTime;
    }

    // console.log(`  Original Time: ${totalOriginalTime.toFixed(3)} ms`);
    // console.log(`  Optimized Time: ${totalOptimizedTime.toFixed(3)} ms`);
    // console.log(`  Speedup: ${(totalOriginalTime / totalOptimizedTime).toFixed(2)}x`);

    // Expect the optimized function to be faster or equivalent
    expect(totalOptimizedTime).toBeLessThanOrEqual(totalOriginalTime);
  });
  it(`Same results for optimized and original functions for query length ${length}`, () => {
    let result1 = '';
    let result2 = '';
    // for each rule
    for (let i = 0; i < queries.length; i++) {
      const query = JSON.stringify(queries[i]);
      // original function
      result1 = oldhashQuery(query);
      // optimized function
      result2 = hashQuery(query);
      // Expect the optimized function to get the same result
      expect(result1).toBe(result2);
    }
  });
});
