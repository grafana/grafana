import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

import {
  getReceiverIntegrationTypes,
  parseStagedAlertmanagerConfig,
  summarizeMatchRecord,
  summarizeRouteMatchers,
  summarizeStagedConfig,
} from './stagedConfig';

describe('parseStagedAlertmanagerConfig', () => {
  it('returns undefined for empty input', () => {
    expect(parseStagedAlertmanagerConfig(undefined)).toBeUndefined();
    expect(parseStagedAlertmanagerConfig('')).toBeUndefined();
  });

  it('returns undefined for invalid YAML', () => {
    expect(parseStagedAlertmanagerConfig('foo: [bar')).toBeUndefined();
  });

  it('parses a valid config', () => {
    const config = parseStagedAlertmanagerConfig('route:\n  receiver: default\nreceivers:\n  - name: default');
    expect(config?.receivers?.[0].name).toBe('default');
  });
});

describe('summarizeStagedConfig', () => {
  it('summarizes resources and preserves receiver order (not alphabetised)', () => {
    const summary = summarizeStagedConfig({
      receivers: [{ name: 'zeta' }, { name: 'alpha' }],
      route: {
        receiver: 'zeta',
        routes: [{ receiver: 'alpha' }, { receiver: 'zeta', routes: [{ receiver: 'alpha' }] }],
      },
      templates: ['t1'],
      time_intervals: [{ name: 'weekends', time_intervals: [] }],
      mute_time_intervals: [{ name: 'holidays', time_intervals: [] }],
      inhibit_rules: [{ equal: ['alertname'] }],
    });

    expect(summary.receivers).toEqual(['zeta', 'alpha']);
    expect(summary.hasRoutingTree).toBe(true);
    expect(summary.templates).toEqual(['t1']);
    expect(summary.timeIntervals).toEqual(['weekends', 'holidays']);
    expect(summary.inhibitionRuleCount).toBe(1);
  });

  it('falls back to template file names when the config has no templates list', () => {
    const summary = summarizeStagedConfig({ receivers: [] }, { 'file.tmpl': '...' });
    expect(summary.templates).toEqual(['file.tmpl']);
  });
});

describe('summarizeRouteMatchers', () => {
  it('prefers object_matchers', () => {
    expect(summarizeRouteMatchers({ object_matchers: [['team', MatcherOperator.equal, 'platform']] })).toBe(
      'team=platform'
    );
  });

  it('falls back to matchers, then match', () => {
    expect(summarizeRouteMatchers({ matchers: ['team=data'] })).toBe('team=data');
    expect(summarizeRouteMatchers({ match: { severity: 'critical' } })).toBe('severity=critical');
  });

  it('includes regex match_re entries', () => {
    expect(summarizeRouteMatchers({ match_re: { team: 'plat.*' } })).toBe('team=~plat.*');
  });

  it('returns an empty string when there are no matchers', () => {
    expect(summarizeRouteMatchers({})).toBe('');
  });
});

describe('getReceiverIntegrationTypes', () => {
  it('maps *_configs keys to human-readable labels', () => {
    expect(getReceiverIntegrationTypes({ name: 'r', pagerduty_configs: [{}], slack_configs: [{}] })).toEqual([
      'PagerDuty',
      'Slack',
    ]);
  });

  it('falls back to the raw base name for unknown integrations', () => {
    expect(getReceiverIntegrationTypes({ name: 'r', custom_configs: [{}] })).toEqual(['custom']);
  });

  it('returns an empty array when the receiver has no integrations', () => {
    expect(getReceiverIntegrationTypes({ name: 'r' })).toEqual([]);
  });
});

describe('summarizeMatchRecord', () => {
  it('combines exact and regex matches', () => {
    expect(summarizeMatchRecord({ severity: 'critical' }, { team: 'plat.*' })).toBe('severity=critical, team=~plat.*');
  });

  it('includes Prometheus-style matcher lists (source_matchers/target_matchers)', () => {
    expect(summarizeMatchRecord(undefined, undefined, ['severity=critical', 'source=infra'])).toBe(
      'severity=critical, source=infra'
    );
  });

  it('returns an empty string when nothing is set', () => {
    expect(summarizeMatchRecord()).toBe('');
  });
});
