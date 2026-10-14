import { createEmptyCriteria } from '../rule-search/criteria';

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
  it('NAV-3: defaults to the Alert destination and Folders mode with no params', () => {
    const result = migrateLegacyRuleListUrlSync(params());
    expect(result.destination).toBe('alert');
    expect(result.mode).toBe('folders');
    expect(result.criteria).toEqual(createEmptyCriteria());
    expect(result.diagnostics).toEqual({ migratedKeys: [], droppedKeys: [] });
  });

  it('NAV-3: type:recording routes to Recording and removes the token', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'type:recording cpu' }));
    expect(result.destination).toBe('recording');
    expect(result.criteria.text).toEqual(['cpu']);
    expect(result.diagnostics).toEqual({ migratedKeys: [], droppedKeys: [] });
  });

  it('NAV-3: legacy ruleType=recording routes to Recording when no type: token is present', () => {
    const result = migrateLegacyRuleListUrlSync(params({ ruleType: 'recording' }));
    expect(result.destination).toBe('recording');
  });

  it('NAV-3: an explicit type: token wins over the legacy ruleType param', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'type:alerting', ruleType: 'recording' }));
    expect(result.destination).toBe('alert');
  });

  it('NAV-3: view=list is preserved as List mode', () => {
    expect(migrateLegacyRuleListUrlSync(params({ view: 'list' })).mode).toBe('list');
  });

  it.each(['grouped', 'state', null])('NAV-3: view=%s becomes Folders mode', (view) => {
    expect(migrateLegacyRuleListUrlSync(params({ view })).mode).toBe('folders');
  });

  it('NAV-3: normalizes the legacy dataSource param into a datasource filter and reports it as migrated', () => {
    const result = migrateLegacyRuleListUrlSync(params({ dataSource: 'my-ds' }));
    expect(result.criteria.dataSourceUids).toEqual(['my-ds']);
    expect(result.diagnostics.migratedKeys).toEqual(['dataSource']);
  });

  it('NAV-3: a canonical datasource: token takes precedence over the legacy dataSource param', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'datasource:canonical-ds', dataSource: 'legacy-ds' }));
    expect(result.criteria.dataSourceUids).toEqual(['canonical-ds']);
    expect(result.diagnostics.migratedKeys).toEqual([]);
  });

  it('NAV-3: normalizes the legacy queryString param into free text', () => {
    const result = migrateLegacyRuleListUrlSync(params({ queryString: 'cpu high' }));
    expect(result.criteria.text).toEqual(['cpu high']);
    expect(result.diagnostics.migratedKeys).toEqual(['queryString']);
  });

  it('NAV-3: drops group: and reports it, since evaluation groups do not exist', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'group:my-group cpu' }));
    expect(result.criteria.text).toEqual(['cpu']);
    expect(result.diagnostics.droppedKeys).toEqual(['group']);
  });

  it('NAV-3: drops source:grafana silently (redundant, not reported)', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'source:grafana cpu' }));
    expect(result.criteria.text).toEqual(['cpu']);
    expect(result.diagnostics.droppedKeys).toEqual([]);
  });

  it('NAV-3: drops source:datasource and reports it (unsupported)', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'source:datasource cpu' }));
    expect(result.criteria.text).toEqual(['cpu']);
    expect(result.diagnostics.droppedKeys).toEqual(['source']);
  });

  it.each(['dashboard:dash-1', 'contactPoint:on-call', 'policy:escalation', 'panelId:4', 'state:firing'])(
    'NAV-4: drops the Alert-only filter %s when migrating to Recording, and reports it',
    (token) => {
      const key = token.split(':')[0];
      const result = migrateLegacyRuleListUrlSync(params({ search: `type:recording ${token}` }));
      expect(result.destination).toBe('recording');
      expect(result.diagnostics.droppedKeys).toEqual([key]);
    }
  );

  it('NAV-4: keeps state: when migrating to Alert', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'state:firing' }));
    expect(result.destination).toBe('alert');
    expect(result.criteria.state).toBe('firing');
    expect(result.diagnostics.droppedKeys).toEqual([]);
  });

  it('NAV-4: keeps health: on both destinations', () => {
    expect(migrateLegacyRuleListUrlSync(params({ search: 'health:error' })).criteria.health).toBe('error');
    expect(migrateLegacyRuleListUrlSync(params({ search: 'type:recording health:error' })).criteria.health).toBe(
      'error'
    );
  });

  it('NAV-4: removes a genuinely unknown token and reports its key', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'unknownFilter:value cpu' }));
    expect(result.diagnostics.droppedKeys).toEqual(['unknownFilter']);
    expect(result.criteria.text).toEqual(['cpu']);
    expect(result.criteria.invalid).toEqual([]);
  });

  it.each([
    ['an incomplete label', 'label:', 'label'],
    ['a label with no key', 'label:=api', 'label'],
    ['an unknown state value', 'state:bogus', 'state'],
    ['an unknown health value', 'health:great', 'health'],
  ])('NAV-4: removes %s and reports its key', (_name, token, key) => {
    const result = migrateLegacyRuleListUrlSync(params({ search: `${token} namespace:folder-1` }));
    expect(result.diagnostics.droppedKeys).toEqual([key]);
    expect(result.criteria.invalid).toEqual([]);
    expect(result.criteria.namespaces).toEqual(['folder-1']);
  });

  it('NAV-4: reports each removed key once, sorted', () => {
    const result = migrateLegacyRuleListUrlSync(params({ search: 'zeta:1 group:g1 zeta:2 alpha:1' }));
    expect(result.diagnostics.droppedKeys).toEqual(['alpha', 'group', 'zeta']);
  });
});
