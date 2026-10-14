import { alertTokens } from './alertTokens';
import { type Criteria, createEmptyCriteria } from './criteria';
import { parse } from './parser';
import { recordingTokens } from './recordingTokens';
import { serialize } from './serializer';

describe('parse', () => {
  it('SEARCH-P10: builds criteria from free text, rule:, and known filter tokens', () => {
    const { criteria } = parse('cpu rule:high-load namespace:folder-1 datasource:ds-1 plugins:hide', alertTokens);

    expect(criteria.text).toEqual(['cpu', 'high-load']);
    expect(criteria.namespaces).toEqual(['folder-1']);
    expect(criteria.dataSourceUids).toEqual(['ds-1']);
    expect(criteria.hidePluginRules).toBe(true);
  });

  it('SEARCH-P11: parses every label operator into a matcher', () => {
    const { criteria } = parse(
      'label:team label:!env label:app=api label:app!=web label:host=~api.* label:host!~web.*',
      alertTokens
    );

    expect(criteria.labels).toEqual([
      { key: 'team', operator: 'exists' },
      { key: 'env', operator: 'absent' },
      { key: 'app', operator: 'equal', value: 'api' },
      { key: 'app', operator: 'notEqual', value: 'web' },
      { key: 'host', operator: 'regex', value: 'api.*' },
      { key: 'host', operator: 'notRegex', value: 'web.*' },
    ]);
  });

  it('SEARCH-P12: records an unknown key:value token as invalid, exactly as written, and keeps it in the token list', () => {
    const { criteria, tokens } = parse('foo:bar namespace:folder-1', alertTokens);

    expect(criteria.namespaces).toEqual(['folder-1']);
    expect(criteria.invalid).toEqual([{ key: 'foo', raw: 'foo:bar' }]);
    const fooToken = tokens.find((t) => t.key === 'foo');
    expect(fooToken).toMatchObject({ key: 'foo', value: 'bar', known: false, incomplete: false });
  });

  it('SEARCH-P13: records an incomplete token (empty value) as invalid and keeps it in the token list', () => {
    const { criteria, tokens } = parse('label: namespace:folder-1', alertTokens);

    expect(criteria.labels).toEqual([]);
    expect(criteria.namespaces).toEqual(['folder-1']);
    expect(criteria.invalid).toEqual([{ key: 'label', raw: 'label:' }]);
    const labelToken = tokens.find((t) => t.key === 'label');
    expect(labelToken).toMatchObject({ key: 'label', value: '', known: true, incomplete: true });
  });

  it.each([
    ['a label with no key', 'label:=api', 'label'],
    ['an unknown paused value', 'paused:maybe', 'paused'],
    ['an unknown plugins value', 'plugins:show', 'plugins'],
    ['an unknown state value', 'state:bogus', 'state'],
    ['an unknown health value', 'health:great', 'health'],
  ])('SEARCH-P18: records %s as invalid instead of ignoring it', (_name, input, key) => {
    const { criteria } = parse(input, alertTokens);

    expect(criteria.invalid).toEqual([{ key, raw: input }]);
  });

  it('SEARCH-P19: records a repeat of a single-value token as invalid and keeps the first value', () => {
    const { criteria } = parse('dashboard:one dashboard:two namespace:a namespace:b', alertTokens);

    expect(criteria.dashboardUid).toBe('one');
    expect(criteria.namespaces).toEqual(['a', 'b']);
    expect(criteria.invalid).toEqual([{ key: 'dashboard', raw: 'dashboard:two' }]);
  });

  it.each([
    ['state:Firing', 'firing'],
    ['state:NORMAL', 'normal'],
    ['state:inactive', 'inactive'],
  ])('SEARCH-P20: accepts %s in any letter case', (input, state) => {
    const { criteria } = parse(input, alertTokens);

    expect(criteria.state).toBe(state);
    expect(criteria.invalid).toEqual([]);
  });

  it('SEARCH-P21: accepts the legacy health spellings err and nodata', () => {
    expect(parse('health:err', alertTokens).criteria.health).toBe('err');
    expect(parse('health:nodata', recordingTokens).criteria.health).toBe('nodata');
  });

  it('SEARCH-P22: records state: as invalid on the Recording registry', () => {
    const { criteria } = parse('state:firing', recordingTokens);

    expect(criteria.state).toBeUndefined();
    expect(criteria.invalid).toEqual([{ key: 'state', raw: 'state:firing' }]);
  });

  it('SEARCH-P23: keeps an unterminated quoted value as typed', () => {
    const { criteria } = parse('label:"team cpu', alertTokens);

    expect(criteria.invalid).toEqual([{ key: 'label', raw: 'label:"team cpu' }]);
  });

  it('SEARCH-P14: recording-only tokens are unknown on the Alert registry', () => {
    const { criteria, tokens } = parse('metric:cpu_usage', alertTokens);

    expect(criteria.metric).toBeUndefined();
    expect(criteria.invalid).toEqual([{ key: 'metric', raw: 'metric:cpu_usage' }]);
    expect(tokens[0]).toMatchObject({ key: 'metric', known: false });
  });

  it('SEARCH-P15: alert-only tokens are unknown on the Recording registry', () => {
    const { criteria, tokens } = parse('dashboard:dash-1', recordingTokens);

    expect(criteria.dashboardUid).toBeUndefined();
    expect(criteria.invalid).toEqual([{ key: 'dashboard', raw: 'dashboard:dash-1' }]);
    expect(tokens[0]).toMatchObject({ key: 'dashboard', known: false });
  });
});

describe('parse(serialize(criteria)) round-trip', () => {
  it('SEARCH-P16: round-trips a fully populated Alert criteria', () => {
    const criteria: Criteria = {
      ...createEmptyCriteria(),
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

    const { criteria: roundTripped } = parse(serialize(criteria), alertTokens);
    expect(roundTripped).toEqual(criteria);
  });

  it('SEARCH-P17: round-trips a fully populated Recording criteria', () => {
    const criteria: Criteria = {
      ...createEmptyCriteria(),
      text: ['high load'],
      namespaces: ['folder-1'],
      dataSourceUids: ['ds-1'],
      labels: [{ key: 'app', operator: 'equal', value: 'api' }],
      hidePluginRules: false,
      metric: 'cpu_usage',
      targetDataSourceUid: 'target-ds-1',
      health: 'ok',
    };

    const { criteria: roundTripped } = parse(serialize(criteria), recordingTokens);
    expect(roundTripped).toEqual(criteria);
  });

  it('SEARCH-P24: round-trips invalid tokens, so a URL the page cannot apply keeps showing them', () => {
    const input = 'namespace:folder-1 foo:bar label: paused:maybe';
    const { criteria } = parse(input, alertTokens);

    expect(parse(serialize(criteria), alertTokens).criteria).toEqual(criteria);
    expect(serialize(criteria)).toBe('namespace:folder-1 foo:bar label: paused:maybe');
  });
});
