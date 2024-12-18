import { renderHook } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { config, locationService } from '@grafana/runtime';
import { AlertingRule, RecordingRule, RuleIdentifier } from 'app/types/unified-alerting';
import {
  GrafanaAlertStateDecision,
  GrafanaRuleDefinition,
  PromAlertingRuleState,
  PromRuleType,
  RulerAlertingRuleDTO,
  RulerGrafanaRuleDTO,
  RulerRecordingRuleDTO,
} from 'app/types/unified-alerting-dto';

import { equal, getRuleIdFromPathname, hashRule, hashRulerRule, parse, stringifyIdentifier } from './rule-id';

const alertingRule = {
  prom: {
    name: 'cpu-over-90',
    query: 'cpu_usage_seconds_total{job="integrations/node_exporter"} > 90',
    labels: { type: 'cpu' },
    annotations: { description: 'CPU usage too high' },
    state: PromAlertingRuleState.Firing,
    type: PromRuleType.Alerting,
    health: 'ok',
  } satisfies AlertingRule,
  ruler: {
    alert: 'cpu-over-90',
    expr: 'cpu_usage_seconds_total{job="integrations/node_exporter"} > 90',
    labels: { type: 'cpu' },
    annotations: { description: 'CPU usage too high' },
  } satisfies RulerAlertingRuleDTO,
};

const recordingRule = {
  prom: {
    name: 'instance:node_num_cpu:sum',
    type: PromRuleType.Recording,
    health: 'ok',
    query: 'count without (mode) (node_cpu_seconds_total{job="integrations/node_exporter"})',
    labels: { type: 'cpu' },
  } satisfies RecordingRule,
  ruler: {
    record: 'instance:node_num_cpu:sum',
    expr: 'count without (mode) (node_cpu_seconds_total{job="integrations/node_exporter"})',
    labels: { type: 'cpu' },
  } satisfies RulerRecordingRuleDTO,
};

describe('hashRulerRule', () => {
  it('should hash recording rules', () => {
    const recordingRule: RulerRecordingRuleDTO = {
      record: 'instance:node_num_cpu:sum',
      expr: 'count without (cpu) (count without (mode) (node_cpu_seconds_total{job="integrations/node_exporter"}))',
      labels: { type: 'cpu' },
    };

    expect(hashRulerRule(recordingRule)).toMatchSnapshot();
  });

  it('should hash alerting rule', () => {
    const alertingRule: RulerAlertingRuleDTO = {
      alert: 'always-alerting',
      expr: 'vector(20) > 7',
      labels: { type: 'cpu' },
      annotations: { description: 'CPU usage too high' },
    };

    expect(hashRulerRule(alertingRule)).toMatchSnapshot();
  });

  it('should hash Grafana Managed rules', () => {
    const RULE_UID = 'abcdef12345';
    const grafanaAlertDefinition: GrafanaRuleDefinition = {
      uid: RULE_UID,
      namespace_uid: 'namespace',
      rule_group: 'my-group',
      title: 'my rule',
      condition: '',
      data: [],
      no_data_state: GrafanaAlertStateDecision.NoData,
      exec_err_state: GrafanaAlertStateDecision.Alerting,
    };
    const grafanaRule: RulerGrafanaRuleDTO = {
      grafana_alert: grafanaAlertDefinition,
      for: '30s',
      labels: { type: 'cpu' },
      annotations: { description: 'CPU usage too high' },
    };

    expect(hashRulerRule(grafanaRule)).toBe(RULE_UID);
  });

  it('should correctly encode and decode unix-style path separators', () => {
    const identifier: RuleIdentifier = {
      ruleSourceName: 'my-datasource',
      namespace: 'folder1/folder2',
      groupName: 'group1/group2',
      ruleName: 'CPU-firing',
      ruleHash: 'abc123',
    };

    const encodedIdentifier = encodeURIComponent(stringifyIdentifier(identifier));

    expect(encodedIdentifier).toBe('pri%24my-datasource%24folder1%1Ffolder2%24group1%1Fgroup2%24CPU-firing%24abc123');
    expect(encodedIdentifier).not.toContain('%2F');
    expect(parse(encodedIdentifier, true)).toStrictEqual(identifier);
  });

  it('should correctly decode regular encoded path separators (%2F)', () => {
    const identifier = {
      ruleSourceName: 'my-datasource',
      namespace: 'folder1/folder2',
      groupName: 'group1/group2',
      ruleName: 'CPU-firing/burning',
      ruleHash: 'abc123',
    };

    expect(
      parse('pri%24my-datasource%24folder1%2Ffolder2%24group1%2Fgroup2%24CPU-firing%2Fburning%24abc123', true)
    ).toStrictEqual(identifier);
  });

  it('should correctly encode and decode windows-style path separators', () => {
    const identifier = {
      ruleSourceName: 'my-datasource',
      namespace: 'folder1\\folder2',
      groupName: 'group1\\group2',
      ruleName: 'CPU-firing',
      ruleHash: 'abc123',
    };

    const encodedIdentifier = encodeURIComponent(stringifyIdentifier(identifier));

    expect(encodedIdentifier).toBe('pri%24my-datasource%24folder1%1Efolder2%24group1%1Egroup2%24CPU-firing%24abc123');
    expect(parse(encodedIdentifier, true)).toStrictEqual(identifier);
  });

  it('should correctly decode a Grafana managed rule id', () => {
    expect(parse('abc123', false)).toStrictEqual({ uid: 'abc123', ruleSourceName: 'grafana' });
  });

  it('should throw for malformed identifier', () => {
    expect(() => parse('foo$bar$baz', false)).toThrow(/failed to parse/i);
  });

  describe('when prometheusRulesPrimary is enabled', () => {
    beforeAll(() => {
      config.featureToggles.alertingPrometheusRulesPrimary = true;
    });
    afterAll(() => {
      config.featureToggles.alertingPrometheusRulesPrimary = false;
    });

    it('should not take query into account', () => {
      const rule1: RulerAlertingRuleDTO = {
        ...alertingRule.ruler,
        expr: 'vector(20) > 7',
      };

      const rule2: RulerAlertingRuleDTO = {
        ...alertingRule.ruler,
        expr: 'http_requests_total{node="node1"}',
      };

      expect(rule1.expr).not.toBe(rule2.expr);
      expect(hashRulerRule(rule1)).toBe(hashRulerRule(rule2));
    });
  });
});

describe('hashRule', () => {
  it('should produce hashRulerRule compatible hashes for alerting rules', () => {
    const promHash = hashRule(alertingRule.prom);
    const rulerHash = hashRulerRule(alertingRule.ruler);

    expect(promHash).toBe(rulerHash);
  });

  it('should produce hashRulerRule compatible hashes for recording rules', () => {
    const promHash = hashRule(recordingRule.prom);
    const rulerHash = hashRulerRule(recordingRule.ruler);

    expect(promHash).toBe(rulerHash);
  });

  describe('when prometheusRulesPrimary is enabled', () => {
    beforeAll(() => {
      config.featureToggles.alertingPrometheusRulesPrimary = true;
    });
    afterAll(() => {
      config.featureToggles.alertingPrometheusRulesPrimary = false;
    });

    it('should not take query into account', () => {
      const rule1: AlertingRule = {
        ...alertingRule.prom,
        query: 'vector(20) > 7',
      };

      const rule2: AlertingRule = {
        ...alertingRule.prom,
        query: 'http_requests_total{node="node1"}',
      };

      expect(rule1.query).not.toBe(rule2.query);
      expect(hashRule(rule1)).toBe(hashRule(rule2));
    });
  });
});

describe('equal', () => {
  it('should return true for Prom and cloud identifiers with the same name, type, query and labels', () => {
    const promIdentifier: RuleIdentifier = {
      ruleSourceName: 'mimir-cloud',
      namespace: 'cloud-alerts',
      groupName: 'cpu-usage',
      ruleName: alertingRule.prom.name,
      ruleHash: hashRule(alertingRule.prom),
    };

    const cloudIdentifier: RuleIdentifier = {
      ruleSourceName: 'mimir-cloud',
      namespace: 'cloud-alerts',
      groupName: 'cpu-usage',
      ruleName: alertingRule.ruler.alert,
      ruleHash: hashRulerRule(alertingRule.ruler),
    };

    const promToCloud = equal(promIdentifier, cloudIdentifier);
    const cloudToProm = equal(cloudIdentifier, promIdentifier);

    expect(promToCloud).toBe(true);
    expect(cloudToProm).toBe(true);
  });
});

describe('useRuleIdFromPathname', () => {
  it('should return undefined when there is no id in params', () => {
    const { result } = renderHook(() => {
      getRuleIdFromPathname({ id: undefined });
    });

    expect(result.current).toBe(undefined);
  });

  it('should decode percent character properly', () => {
    locationService.push('/alerting/gdev-cortex/abc%25def/view');
    const { result } = renderHook(
      () => {
        return getRuleIdFromPathname({ id: 'abc%25def' });
      },
      { wrapper: TestProvider }
    );

    expect(result.current).toBe('abc%25def');
  });
});
