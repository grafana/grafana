import { getRuleSearchQueryViolations } from '../mocks/ruleSearchQueryContract';
import { type Criteria, type HealthValue, type StateValue, createEmptyCriteria } from '../rule-search/criteria';

import { buildAlertRuleSearchQuery } from './alertRuleSearchQuery';

const alertFields = [
  'title',
  'folder',
  'paused',
  'labels',
  'annotations',
  'datasourceUIDs',
  'interval',
  'notificationType',
  'receiver',
  'routingTree',
  'dashboardUID',
  'panelID',
  'health',
  'state',
  'stateReason',
  'lastEvaluationTime',
  'evaluationDuration',
  'lastError',
  'totalsHealthy',
  'totalsFiring',
  'totalsPending',
  'totalsRecovering',
  'totalsNoData',
  'totalsError',
];

describe('buildAlertRuleSearchQuery', () => {
  it('an empty criteria has no where clause and default sort/limit/fields', () => {
    expect(buildAlertRuleSearchQuery(createEmptyCriteria())).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      where: undefined,
      sort: [{ field: 'title', direction: 'asc' }],
      fields: alertFields,
      limit: 40,
    });
  });

  it('free text and rule: merge into a single text leaf', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), text: ['cpu', 'high load'] };
    expect(buildAlertRuleSearchQuery(criteria).where).toEqual({ text: { value: 'cpu high load' } });
  });

  it('multiple folders become one In filter', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), namespaces: ['folder-1', 'folder-2'] };
    expect(buildAlertRuleSearchQuery(criteria).where).toEqual({
      filter: { field: 'folder', operator: 'In', values: ['folder-1', 'folder-2'] },
    });
  });

  it('query data sources use the datasourceUIDs field', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), dataSourceUids: ['ds-1'] };
    expect(buildAlertRuleSearchQuery(criteria).where).toEqual({
      filter: { field: 'datasourceUIDs', operator: 'In', values: ['ds-1'] },
    });
  });

  it.each<[string, Criteria['labels'][number], object]>([
    ['exists', { key: 'team', operator: 'exists' }, { filter: { field: 'labels', operator: 'In', values: ['team'] } }],
    [
      'absent',
      { key: 'team', operator: 'absent' },
      { filter: { field: 'labels', operator: 'NotIn', values: ['team'] } },
    ],
    [
      'equal',
      { key: 'team', operator: 'equal', value: 'api' },
      { filter: { field: 'labels', operator: 'In', values: ['team=api'] } },
    ],
    [
      'notEqual',
      { key: 'team', operator: 'notEqual', value: 'api' },
      { filter: { field: 'labels', operator: 'NotIn', values: ['team=api'] } },
    ],
    [
      'regex',
      { key: 'team', operator: 'regex', value: 'api.*' },
      { regex: { field: 'labels', pattern: 'team=api.*' } },
    ],
    [
      'notRegex',
      { key: 'team', operator: 'notRegex', value: 'api.*' },
      { regex: { field: 'labels', pattern: 'team=api.*', negate: true } },
    ],
  ])('maps the %s label matcher to its own leaf', (_name, label, expectedLeaf) => {
    const criteria: Criteria = { ...createEmptyCriteria(), labels: [label] };
    expect(buildAlertRuleSearchQuery(criteria).where).toEqual(expectedLeaf);
  });

  it('multiple label matchers each get their own leaf, ANDed', () => {
    const criteria: Criteria = {
      ...createEmptyCriteria(),
      labels: [
        { key: 'team', operator: 'equal', value: 'api' },
        { key: 'env', operator: 'exists' },
      ],
    };
    expect(buildAlertRuleSearchQuery(criteria).where).toEqual({
      and: [
        { filter: { field: 'labels', operator: 'In', values: ['team=api'] } },
        { filter: { field: 'labels', operator: 'In', values: ['env'] } },
      ],
    });
  });

  it('plugins:hide excludes only plugin-managed rules, keeping rules without the origin label', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), hidePluginRules: true };
    expect(buildAlertRuleSearchQuery(criteria).where).toEqual({
      regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true },
    });
  });

  it.each([
    { paused: 'true', values: ['true'] },
    // NotIn is not accepted on paused, so "not paused" is In ["false"].
    { paused: 'false', values: ['false'] },
  ] as const)('paused:$paused filters paused In $values', ({ paused, values }) => {
    const criteria: Criteria = { ...createEmptyCriteria(), paused };
    expect(buildAlertRuleSearchQuery(criteria).where).toEqual({ filter: { field: 'paused', operator: 'In', values } });
  });

  it('dashboard and panel combine under one and', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), dashboardUid: 'dash-1', panelId: '4' };
    expect(buildAlertRuleSearchQuery(criteria).where).toEqual({
      and: [
        { filter: { field: 'dashboardUID', operator: 'In', values: ['dash-1'] } },
        { filter: { field: 'panelID', operator: 'In', values: ['4'] } },
      ],
    });
  });

  it('panel without a dashboard is not sent (panel IDs are dashboard-local)', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), panelId: '4' };
    expect(buildAlertRuleSearchQuery(criteria).where).toBeUndefined();
  });

  it.each<[string, Partial<Criteria>, string, string]>([
    ['a named policy', { policy: 'escalation' }, 'routingTree', 'escalation'],
    ['a contact point', { contactPoint: 'on-call' }, 'receiver', 'on-call'],
    ['both (the policy wins)', { policy: 'escalation', contactPoint: 'on-call' }, 'routingTree', 'escalation'],
  ])('%s filters by %s', (_name, partial, field, value) => {
    const criteria: Criteria = { ...createEmptyCriteria(), ...partial };
    expect(buildAlertRuleSearchQuery(criteria).where).toEqual({ filter: { field, operator: 'In', values: [value] } });
  });

  it('the default policy sends no notificationType filter', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), policy: 'default' };
    expect(buildAlertRuleSearchQuery(criteria).where).toBeUndefined();
  });

  it.each<[StateValue, string[]]>([
    ['firing', ['Firing']],
    ['pending', ['Pending']],
    ['recovering', ['Recovering']],
    ['normal', ['Healthy', 'Inactive']],
    ['inactive', ['Healthy', 'Inactive']],
  ])('state:%s sends state In %j', (state, values) => {
    const criteria: Criteria = { ...createEmptyCriteria(), state };
    expect(buildAlertRuleSearchQuery(criteria).where).toEqual({ filter: { field: 'state', operator: 'In', values } });
  });

  it.each<[HealthValue, string]>([
    ['ok', 'OK'],
    ['nodata', 'NoData'],
    ['error', 'Error'],
    ['err', 'Error'],
    ['unknown', 'Unknown'],
  ])('health:%s sends health In [%s]', (health, value) => {
    const criteria: Criteria = { ...createEmptyCriteria(), health };
    expect(buildAlertRuleSearchQuery(criteria).where).toEqual({
      filter: { field: 'health', operator: 'In', values: [value] },
    });
  });

  it('state and health are separate leaves under one and', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), state: 'firing', health: 'error' };
    expect(buildAlertRuleSearchQuery(criteria).where).toEqual({
      and: [
        { filter: { field: 'state', operator: 'In', values: ['Firing'] } },
        { filter: { field: 'health', operator: 'In', values: ['Error'] } },
      ],
    });
  });

  it('passes through limit and continue', () => {
    const query = buildAlertRuleSearchQuery(createEmptyCriteria(), { limit: 10, continue: 'opaque-token' });
    expect(query.limit).toBe(10);
    expect(query.continue).toBe('opaque-token');
  });

  it.each<[string, Criteria]>([
    ['empty criteria', createEmptyCriteria()],
    ['free text', { ...createEmptyCriteria(), text: ['cpu', 'high'] }],
    [
      'multiple folders and data sources',
      { ...createEmptyCriteria(), namespaces: ['f1', 'f2'], dataSourceUids: ['a', 'b'] },
    ],
    [
      'every label operator',
      {
        ...createEmptyCriteria(),
        labels: [
          { key: 'a', operator: 'exists' },
          { key: 'b', operator: 'absent' },
          { key: 'c', operator: 'equal', value: 'x' },
          { key: 'd', operator: 'notEqual', value: 'y' },
          { key: 'e', operator: 'regex', value: 'z.*' },
          { key: 'f', operator: 'notRegex', value: 'w.*' },
        ],
      },
    ],
    ['hidden plugin rules', { ...createEmptyCriteria(), hidePluginRules: true }],
    ['paused false', { ...createEmptyCriteria(), paused: 'false' }],
    ['paused true', { ...createEmptyCriteria(), paused: 'true' }],
    ['dashboard and panel', { ...createEmptyCriteria(), dashboardUid: 'dash', panelId: '4' }],
    ['named policy', { ...createEmptyCriteria(), policy: 'escalation' }],
    ['contact point', { ...createEmptyCriteria(), contactPoint: 'on-call' }],
    ['default policy', { ...createEmptyCriteria(), policy: 'default' }],
    ['state and health', { ...createEmptyCriteria(), state: 'firing', health: 'error' }],
    ['a state that sends two values', { ...createEmptyCriteria(), state: 'normal' }],
  ])('builds a request the per-kind rule search accepts for %s', (_name, criteria) => {
    expect(getRuleSearchQueryViolations(buildAlertRuleSearchQuery(criteria, { continue: 'tok' }), 'alert')).toEqual([]);
  });
});
