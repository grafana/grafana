import { getRuleSearchQueryViolations } from '../mocks/ruleSearchQueryContract';
import {
  type HealthValue,
  type RuleSearchFilter,
  type StateValue,
  createEmptyFilter,
} from '../rule-search/ruleSearchFilter';

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
  it('an empty filter has no where clause and default sort/limit/fields', () => {
    expect(buildAlertRuleSearchQuery(createEmptyFilter())).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      where: undefined,
      sort: [{ field: 'title', direction: 'asc' }],
      fields: alertFields,
      limit: 40,
    });
  });

  it('free text and rule: merge into a single text leaf', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), text: ['cpu', 'high load'] };
    expect(buildAlertRuleSearchQuery(filter).where).toEqual({ text: { value: 'cpu high load' } });
  });

  it('multiple folders become one In filter', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), namespaces: ['folder-1', 'folder-2'] };
    expect(buildAlertRuleSearchQuery(filter).where).toEqual({
      filter: { field: 'folder', operator: 'In', values: ['folder-1', 'folder-2'] },
    });
  });

  it('query data sources use the datasourceUIDs field', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), dataSourceUids: ['ds-1'] };
    expect(buildAlertRuleSearchQuery(filter).where).toEqual({
      filter: { field: 'datasourceUIDs', operator: 'In', values: ['ds-1'] },
    });
  });

  it.each<[string, RuleSearchFilter['labels'][number], object]>([
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
    const filter: RuleSearchFilter = { ...createEmptyFilter(), labels: [label] };
    expect(buildAlertRuleSearchQuery(filter).where).toEqual(expectedLeaf);
  });

  it('multiple label matchers each get their own leaf, ANDed', () => {
    const filter: RuleSearchFilter = {
      ...createEmptyFilter(),
      labels: [
        { key: 'team', operator: 'equal', value: 'api' },
        { key: 'env', operator: 'exists' },
      ],
    };
    expect(buildAlertRuleSearchQuery(filter).where).toEqual({
      and: [
        { filter: { field: 'labels', operator: 'In', values: ['team=api'] } },
        { filter: { field: 'labels', operator: 'In', values: ['env'] } },
      ],
    });
  });

  it('plugins:hide excludes only plugin-managed rules, keeping rules without the origin label', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), hidePluginRules: true };
    expect(buildAlertRuleSearchQuery(filter).where).toEqual({
      regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true },
    });
  });

  it.each([
    { paused: 'true', values: ['true'] },
    // NotIn is not accepted on paused, so "not paused" is In ["false"].
    { paused: 'false', values: ['false'] },
  ] as const)('paused:$paused filters paused In $values', ({ paused, values }) => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), paused };
    expect(buildAlertRuleSearchQuery(filter).where).toEqual({ filter: { field: 'paused', operator: 'In', values } });
  });

  it('dashboard and panel combine under one and', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), dashboardUid: 'dash-1', panelId: '4' };
    expect(buildAlertRuleSearchQuery(filter).where).toEqual({
      and: [
        { filter: { field: 'dashboardUID', operator: 'In', values: ['dash-1'] } },
        { filter: { field: 'panelID', operator: 'In', values: ['4'] } },
      ],
    });
  });

  it('panel without a dashboard is not sent (panel IDs are dashboard-local)', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), panelId: '4' };
    expect(buildAlertRuleSearchQuery(filter).where).toBeUndefined();
  });

  it.each<[string, Partial<RuleSearchFilter>, string, string]>([
    ['a named policy', { policy: 'escalation' }, 'routingTree', 'escalation'],
    ['a contact point', { contactPoint: 'on-call' }, 'receiver', 'on-call'],
    ['both (the policy wins)', { policy: 'escalation', contactPoint: 'on-call' }, 'routingTree', 'escalation'],
  ])('%s filters by %s', (_name, partial, field, value) => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), ...partial };
    expect(buildAlertRuleSearchQuery(filter).where).toEqual({ filter: { field, operator: 'In', values: [value] } });
  });

  it('the default policy sends no notificationType filter', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), policy: 'default' };
    expect(buildAlertRuleSearchQuery(filter).where).toBeUndefined();
  });

  it.each<[StateValue, string[]]>([
    ['firing', ['Firing']],
    ['pending', ['Pending']],
    ['recovering', ['Recovering']],
    ['normal', ['Healthy', 'Inactive']],
    ['inactive', ['Healthy', 'Inactive']],
  ])('state:%s sends state In %j', (state, values) => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), state };
    expect(buildAlertRuleSearchQuery(filter).where).toEqual({ filter: { field: 'state', operator: 'In', values } });
  });

  it.each<[HealthValue, string]>([
    ['ok', 'OK'],
    ['nodata', 'NoData'],
    ['error', 'Error'],
    ['err', 'Error'],
    ['unknown', 'Unknown'],
  ])('health:%s sends health In [%s]', (health, value) => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), health };
    expect(buildAlertRuleSearchQuery(filter).where).toEqual({
      filter: { field: 'health', operator: 'In', values: [value] },
    });
  });

  it('state and health are separate leaves under one and', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), state: 'firing', health: 'error' };
    expect(buildAlertRuleSearchQuery(filter).where).toEqual({
      and: [
        { filter: { field: 'state', operator: 'In', values: ['Firing'] } },
        { filter: { field: 'health', operator: 'In', values: ['Error'] } },
      ],
    });
  });

  it('passes the continuation token through', () => {
    expect(buildAlertRuleSearchQuery(createEmptyFilter(), 'opaque-token').continue).toBe('opaque-token');
  });

  it.each<[string, RuleSearchFilter]>([
    ['empty filter', createEmptyFilter()],
    ['free text', { ...createEmptyFilter(), text: ['cpu', 'high'] }],
    [
      'multiple folders and data sources',
      { ...createEmptyFilter(), namespaces: ['f1', 'f2'], dataSourceUids: ['a', 'b'] },
    ],
    [
      'every label operator',
      {
        ...createEmptyFilter(),
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
    ['hidden plugin rules', { ...createEmptyFilter(), hidePluginRules: true }],
    ['paused false', { ...createEmptyFilter(), paused: 'false' }],
    ['paused true', { ...createEmptyFilter(), paused: 'true' }],
    ['dashboard and panel', { ...createEmptyFilter(), dashboardUid: 'dash', panelId: '4' }],
    ['named policy', { ...createEmptyFilter(), policy: 'escalation' }],
    ['contact point', { ...createEmptyFilter(), contactPoint: 'on-call' }],
    ['default policy', { ...createEmptyFilter(), policy: 'default' }],
    ['state and health', { ...createEmptyFilter(), state: 'firing', health: 'error' }],
    ['a state that sends two values', { ...createEmptyFilter(), state: 'normal' }],
  ])('builds a request the per-kind rule search accepts for %s', (_name, filter) => {
    expect(getRuleSearchQueryViolations(buildAlertRuleSearchQuery(filter, 'tok'), 'alert')).toEqual([]);
  });
});
