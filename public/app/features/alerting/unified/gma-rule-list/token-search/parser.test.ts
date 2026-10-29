import { alertTokens } from './alertTokens';
import { parse } from './parser';
import { recordingTokens } from './recordingTokens';
import { type RuleSearchFilter, createEmptyFilter } from './ruleSearchFilter';
import { serialize } from './serializer';

describe('parse', () => {
  it('builds a filter from free text, rule:, and known filter tokens', () => {
    const filter = parse('cpu rule:high-load namespace:folder-1 datasource:ds-1 plugins:hide', alertTokens);

    expect(filter.text).toEqual(['cpu', 'high-load']);
    expect(filter.namespaces).toEqual(['folder-1']);
    expect(filter.dataSourceUids).toEqual(['ds-1']);
    expect(filter.hidePluginRules).toBe(true);
  });

  it('parses every label operator into a matcher', () => {
    const filter = parse(
      'label:team label:!env label:app=api label:app!=web label:host=~api.* label:host!~web.*',
      alertTokens
    );

    expect(filter.labels).toEqual([
      { key: 'team', operator: 'exists' },
      { key: 'env', operator: 'absent' },
      { key: 'app', operator: 'equal', value: 'api' },
      { key: 'app', operator: 'notEqual', value: 'web' },
      { key: 'host', operator: 'regex', value: 'api.*' },
      { key: 'host', operator: 'notRegex', value: 'web.*' },
    ]);
  });

  it('records an unknown key:value token as invalid, exactly as written', () => {
    const filter = parse('foo:bar namespace:folder-1', alertTokens);

    expect(filter.namespaces).toEqual(['folder-1']);
    expect(filter.invalid).toEqual([{ key: 'foo', raw: 'foo:bar' }]);
  });

  it('records an incomplete token (empty value) as invalid', () => {
    const filter = parse('label: namespace:folder-1', alertTokens);

    expect(filter.labels).toEqual([]);
    expect(filter.namespaces).toEqual(['folder-1']);
    expect(filter.invalid).toEqual([{ key: 'label', raw: 'label:' }]);
  });

  it.each([
    ['a label with no key', 'label:=api', 'label'],
    ['an unknown paused value', 'paused:maybe', 'paused'],
    ['an unknown plugins value', 'plugins:show', 'plugins'],
    ['an unknown state value', 'state:bogus', 'state'],
    ['an unknown health value', 'health:great', 'health'],
  ])('records %s as invalid instead of ignoring it', (_name, input, key) => {
    const filter = parse(input, alertTokens);

    expect(filter.invalid).toEqual([{ key, raw: input }]);
  });

  it('records a repeat of a single-value token as invalid and keeps the first value', () => {
    const filter = parse('dashboard:one dashboard:two namespace:a namespace:b', alertTokens);

    expect(filter.dashboardUid).toBe('one');
    expect(filter.namespaces).toEqual(['a', 'b']);
    expect(filter.invalid).toEqual([{ key: 'dashboard', raw: 'dashboard:two' }]);
  });

  it.each([
    ['state:Firing', 'firing'],
    ['state:NORMAL', 'normal'],
    ['state:inactive', 'inactive'],
  ])('accepts %s in any letter case', (input, state) => {
    const filter = parse(input, alertTokens);

    expect(filter.state).toBe(state);
    expect(filter.invalid).toEqual([]);
  });

  it("reads the default routing tree's name as the default policy", () => {
    expect(parse('policy:user-defined', alertTokens).policy).toBe('default');
    expect(parse('policy:escalation', alertTokens).policy).toBe('escalation');
  });

  it('accepts the legacy health spellings err and nodata', () => {
    expect(parse('health:err', alertTokens).health).toBe('err');
    expect(parse('health:nodata', recordingTokens).health).toBe('nodata');
  });

  it('records state: as invalid on the Recording registry', () => {
    const filter = parse('state:firing', recordingTokens);

    expect(filter.state).toBeUndefined();
    expect(filter.invalid).toEqual([{ key: 'state', raw: 'state:firing' }]);
  });

  it('keeps an unterminated quoted value as typed', () => {
    const filter = parse('label:"team cpu', alertTokens);

    expect(filter.invalid).toEqual([{ key: 'label', raw: 'label:"team cpu' }]);
  });

  it('recording-only tokens are unknown on the Alert registry', () => {
    const filter = parse('metric:cpu_usage', alertTokens);

    expect(filter.metric).toBeUndefined();
    expect(filter.invalid).toEqual([{ key: 'metric', raw: 'metric:cpu_usage' }]);
  });

  it('alert-only tokens are unknown on the Recording registry', () => {
    const filter = parse('dashboard:dash-1', recordingTokens);

    expect(filter.dashboardUid).toBeUndefined();
    expect(filter.invalid).toEqual([{ key: 'dashboard', raw: 'dashboard:dash-1' }]);
  });
});

describe('parse(serialize(filter)) round-trip', () => {
  it('round-trips a fully populated Alert filter', () => {
    const filter: RuleSearchFilter = {
      ...createEmptyFilter(),
      text: ['cpu', 'high load'],
      namespaces: ['folder-1', 'folder-2'],
      dataSourceUids: ['ds-1'],
      labels: [
        { key: 'team', operator: 'exists' },
        { key: 'env', operator: 'absent' },
        { key: 'app', operator: 'equal', value: 'api' },
        { key: 'app', operator: 'notEqual', value: 'web' },
        { key: 'host', operator: 'regex', value: 'api.*' },
      ],
      hidePluginRules: true,
      dashboardUid: 'dash-1',
      panelId: '4',
      policy: 'default',
      paused: 'true',
      state: 'firing',
      health: 'error',
    };

    const roundTripped = parse(serialize(filter), alertTokens);
    expect(roundTripped).toEqual(filter);
  });

  it('round-trips a fully populated Recording filter', () => {
    const filter: RuleSearchFilter = {
      ...createEmptyFilter(),
      text: ['high load'],
      namespaces: ['folder-1'],
      dataSourceUids: ['ds-1'],
      labels: [{ key: 'app', operator: 'equal', value: 'api' }],
      hidePluginRules: false,
      metric: 'cpu_usage',
      targetDataSourceUid: 'target-ds-1',
      health: 'ok',
    };

    const roundTripped = parse(serialize(filter), recordingTokens);
    expect(roundTripped).toEqual(filter);
  });

  it('round-trips invalid tokens, so a URL the page cannot apply keeps showing them', () => {
    const input = 'namespace:folder-1 foo:bar label: paused:maybe';
    const filter = parse(input, alertTokens);

    expect(parse(serialize(filter), alertTokens)).toEqual(filter);
    expect(serialize(filter)).toBe('namespace:folder-1 foo:bar label: paused:maybe');
  });
});
