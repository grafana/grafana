import {
  GrafanaAlertStateDecision,
  GrafanaRuleDefinition,
  RulerAlertingRuleDTO,
  RulerGrafanaRuleDTO,
  RulerRecordingRuleDTO,
} from 'app/types/unified-alerting-dto';

import { hashRulerRule, parse, stringifyIdentifier } from './rule-id';

describe('hashRulerRule', () => {
  it('should not hash unknown rule types', () => {
    const unknownRule = {};

    expect(() => {
      // @ts-ignore
      hashRulerRule(unknownRule);
    }).toThrowError();
  });
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
      namespace_id: 0,
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
    const identifier = {
      ruleSourceName: 'my-datasource',
      namespace: 'folder1/folder2',
      groupName: 'group1/group2',
      ruleHash: 'abc123',
    };

    const encodedIdentifier = encodeURIComponent(stringifyIdentifier(identifier));

    expect(encodedIdentifier).toBe('pri%24my-datasource%24folder1%1Ffolder2%24group1%1Fgroup2%24abc123');
    expect(encodedIdentifier).not.toContain('%2F');
    expect(parse(encodedIdentifier, true)).toStrictEqual(identifier);
  });

  it('should correctly decode regular encoded path separators (%2F)', () => {
    const identifier = {
      ruleSourceName: 'my-datasource',
      namespace: 'folder1/folder2',
      groupName: 'group1/group2',
      ruleHash: 'abc123',
    };

    expect(parse('pri%24my-datasource%24folder1%2Ffolder2%24group1%2Fgroup2%24abc123', true)).toStrictEqual(identifier);
  });

  it('should correctly encode and decode windows-style path separators', () => {
    const identifier = {
      ruleSourceName: 'my-datasource',
      namespace: 'folder1\\folder2',
      groupName: 'group1\\group2',
      ruleHash: 'abc123',
    };

    const encodedIdentifier = encodeURIComponent(stringifyIdentifier(identifier));

    expect(encodedIdentifier).toBe('pri%24my-datasource%24folder1%1Efolder2%24group1%1Egroup2%24abc123');
    expect(parse(encodedIdentifier, true)).toStrictEqual(identifier);
  });

  it('should correctly decode a Grafana managed rule id', () => {
    expect(parse('abc123', false)).toStrictEqual({ uid: 'abc123', ruleSourceName: 'grafana' });
  });

  it('should throw for malformed identifier', () => {
    expect(() => parse('foo$bar$baz', false)).toThrow(/failed to parse/i);
  });
});
