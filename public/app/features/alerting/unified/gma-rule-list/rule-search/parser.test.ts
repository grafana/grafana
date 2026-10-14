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

  it('SEARCH-P12: keeps an unknown key:value token out of criteria but in the token list', () => {
    const { criteria, tokens } = parse('foo:bar namespace:folder-1', alertTokens);

    expect(criteria.namespaces).toEqual(['folder-1']);
    const fooToken = tokens.find((t) => t.key === 'foo');
    expect(fooToken).toMatchObject({ key: 'foo', value: 'bar', known: false, incomplete: false });
  });

  it('SEARCH-P13: keeps an incomplete token (empty value) out of criteria but in the token list', () => {
    const { criteria, tokens } = parse('label: namespace:folder-1', alertTokens);

    expect(criteria.labels).toEqual([]);
    expect(criteria.namespaces).toEqual(['folder-1']);
    const labelToken = tokens.find((t) => t.key === 'label');
    expect(labelToken).toMatchObject({ key: 'label', value: '', known: true, incomplete: true });
  });

  it('SEARCH-P14: recording-only tokens are unknown on the Alert registry', () => {
    const { criteria, tokens } = parse('metric:cpu_usage', alertTokens);

    expect(criteria.metric).toBeUndefined();
    expect(tokens[0]).toMatchObject({ key: 'metric', known: false });
  });

  it('SEARCH-P15: alert-only tokens are unknown on the Recording registry', () => {
    const { criteria, tokens } = parse('dashboard:dash-1', recordingTokens);

    expect(criteria.dashboardUid).toBeUndefined();
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
      health: 'recording',
    };

    const { criteria: roundTripped } = parse(serialize(criteria), recordingTokens);
    expect(roundTripped).toEqual(criteria);
  });
});
