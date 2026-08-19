import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

import { parsePromQLStyleMatcherLooseSafe } from '../../utils/matchers';

import {
  encodeRouteMatchersQuery,
  getReceiverIntegrationTypes,
  parseStagedAlertmanagerConfig,
  resolveMergedNames,
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

describe('resolveMergedNames', () => {
  it('keeps names the live config does not already own', () => {
    expect(resolveMergedNames(['slack', 'pagerduty'], ['email'], 'prom-prod')).toEqual(['slack', 'pagerduty']);
  });

  it('suffixes names that collide with the live config', () => {
    expect(resolveMergedNames(['default', 'slack'], ['default'], 'prom-prod')).toEqual(['default_prom-prod', 'slack']);
  });

  it('appends a counter when the suffixed name is also taken', () => {
    expect(resolveMergedNames(['default'], ['default', 'default_prom-prod'], 'prom-prod')).toEqual([
      'default_prom-prod_01',
    ]);
    expect(
      resolveMergedNames(['default'], ['default', 'default_prom-prod', 'default_prom-prod_01'], 'prom-prod')
    ).toEqual(['default_prom-prod_02']);
  });

  it('renames only the later of two staged resources sharing a name', () => {
    expect(resolveMergedNames(['dupe', 'dupe'], [], 'prom-prod')).toEqual(['dupe', 'dupe_prom-prod']);
  });

  it('returns names unchanged when there is no live config to collide with', () => {
    expect(resolveMergedNames(['a', 'b'], [], 'prom-prod')).toEqual(['a', 'b']);
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

describe('encodeRouteMatchersQuery', () => {
  it('quotes values so the routes filter parses them back correctly', () => {
    const query = encodeRouteMatchersQuery({ object_matchers: [['team', MatcherOperator.equal, 'platform']] });
    expect(query).toBe('team="platform"');
    expect(parsePromQLStyleMatcherLooseSafe(query)).toEqual([
      { name: 'team', value: 'platform', isRegex: false, isEqual: true },
    ]);
  });

  it('keeps values containing commas intact through the filter parser', () => {
    // Unquoted, the filter would split on the comma and drop the matcher; quoting keeps it as one value.
    const query = encodeRouteMatchersQuery({ object_matchers: [['region', MatcherOperator.equal, 'us-east,us-west']] });
    expect(query).toBe('region="us-east,us-west"');
    expect(parsePromQLStyleMatcherLooseSafe(query)).toEqual([
      { name: 'region', value: 'us-east,us-west', isRegex: false, isEqual: true },
    ]);
  });

  it('returns an empty string when there are no matchers', () => {
    expect(encodeRouteMatchersQuery({})).toBe('');
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
