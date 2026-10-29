import { createEmptyFilter } from '../token-search/ruleSearchFilter';

import { type LegacyRuleListParams, migrateLegacyRuleListUrlSync } from './migrationSync';

function params(overrides: Partial<LegacyRuleListParams> = {}): LegacyRuleListParams {
  return {
    search: '',
    view: null,
    dataSource: null,
    alertState: null,
    ruleType: null,
    queryString: null,
    ...overrides,
  };
}

describe('migrateLegacyRuleListUrlSync', () => {
  it('defaults to the Alert destination and Folders mode with no params', () => {
    const result = migrateLegacyRuleListUrlSync(params());
    expect(result.destination).toBe('alert');
    expect(result.mode).toBe('folders');
    expect(result.filter).toEqual(createEmptyFilter());
    expect(result.diagnostics).toEqual({ migratedKeys: [], droppedKeys: [] });
  });

  it('type:recording routes to Recording and removes the token', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'type:recording cpu' }));
    expect(result.destination).toBe('recording');
    expect(result.filter.text).toEqual(['cpu']);
    expect(result.diagnostics).toEqual({ migratedKeys: [], droppedKeys: [] });
  });

  it('legacy ruleType=recording routes to Recording when no type: token is present', () => {
    const result = migrateLegacyRuleListUrlSync(params({ ruleType: 'recording' }));
    expect(result.destination).toBe('recording');
  });

  it('an explicit type: token wins over the legacy ruleType param', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'type:alerting', ruleType: 'recording' }));
    expect(result.destination).toBe('alert');
  });

  it('view=list is preserved as List mode', () => {
    expect(migrateLegacyRuleListUrlSync(params({ view: 'list' })).mode).toBe('list');
  });

  it.each(['grouped', 'state', null])('view=%s becomes Folders mode', (view) => {
    expect(migrateLegacyRuleListUrlSync(params({ view })).mode).toBe('folders');
  });

  it('normalizes the legacy dataSource param into a datasource filter and reports it as migrated', () => {
    const result = migrateLegacyRuleListUrlSync(params({ dataSource: 'my-ds' }));
    expect(result.filter.dataSourceUids).toEqual(['my-ds']);
    expect(result.diagnostics.migratedKeys).toEqual(['dataSource']);
  });

  it('a canonical datasource: token takes precedence over the legacy dataSource param', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'datasource:canonical-ds', dataSource: 'legacy-ds' }));
    expect(result.filter.dataSourceUids).toEqual(['canonical-ds']);
    expect(result.diagnostics.migratedKeys).toEqual([]);
  });

  it('normalizes the legacy queryString param into free text', () => {
    const result = migrateLegacyRuleListUrlSync(params({ queryString: 'cpu high' }));
    expect(result.filter.text).toEqual(['cpu high']);
    expect(result.diagnostics.migratedKeys).toEqual(['queryString']);
  });

  it('drops group: and reports it, since evaluation groups do not exist', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'group:my-group cpu' }));
    expect(result.filter.text).toEqual(['cpu']);
    expect(result.diagnostics.droppedKeys).toEqual(['group']);
  });

  it('drops source:grafana silently (redundant, not reported)', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'source:grafana cpu' }));
    expect(result.filter.text).toEqual(['cpu']);
    expect(result.diagnostics.droppedKeys).toEqual([]);
  });

  it('drops source:datasource and reports it (unsupported)', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'source:datasource cpu' }));
    expect(result.filter.text).toEqual(['cpu']);
    expect(result.diagnostics.droppedKeys).toEqual(['source']);
  });

  it.each(['dashboard:dash-1', 'contactPoint:on-call', 'policy:escalation', 'panelId:4', 'state:firing'])(
    'drops the Alert-only filter %s when migrating to Recording, and reports it',
    (token) => {
      const key = token.split(':')[0];
      const result = migrateLegacyRuleListUrlSync(params({ search: `type:recording ${token}` }));
      expect(result.destination).toBe('recording');
      expect(result.diagnostics.droppedKeys).toEqual([key]);
    }
  );

  it('keeps state: when migrating to Alert', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'state:firing' }));
    expect(result.destination).toBe('alert');
    expect(result.filter.state).toBe('firing');
    expect(result.diagnostics.droppedKeys).toEqual([]);
  });

  it('keeps health: on both destinations', () => {
    expect(migrateLegacyRuleListUrlSync(params({ search: 'health:error' })).filter.health).toBe('error');
    expect(migrateLegacyRuleListUrlSync(params({ search: 'type:recording health:error' })).filter.health).toBe('error');
  });

  it('removes a genuinely unknown token and reports its key', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'unknownFilter:value cpu' }));
    expect(result.diagnostics.droppedKeys).toEqual(['unknownFilter']);
    expect(result.filter.text).toEqual(['cpu']);
    expect(result.filter.invalid).toEqual([]);
  });

  it.each([
    { name: 'an incomplete label', token: 'label:', key: 'label' },
    { name: 'a label with no key', token: 'label:=api', key: 'label' },
    { name: 'an unknown state value', token: 'state:bogus', key: 'state' },
    { name: 'an unknown health value', token: 'health:great', key: 'health' },
  ])('removes $name and reports its key', ({ token, key }) => {
    const result = migrateLegacyRuleListUrlSync(params({ search: `${token} namespace:folder-1` }));
    expect(result.diagnostics.droppedKeys).toEqual([key]);
    expect(result.filter.invalid).toEqual([]);
    expect(result.filter.namespaces).toEqual(['folder-1']);
  });

  it('reports each removed key once, sorted', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'zeta:1 group:g1 zeta:2 alpha:1' }));
    expect(result.diagnostics.droppedKeys).toEqual(['alpha', 'group', 'zeta']);
  });
});
