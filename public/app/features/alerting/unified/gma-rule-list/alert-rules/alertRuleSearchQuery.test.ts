import { type ListAlertRuleSearchRulesV0Alpha1RequestBody } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { parse } from '../rule-search/parser';
import { type SharedRuleFilter, createRulesApiFilter } from '../rule-search/sharedRuleFilter';

import { alertRuleSearchSchema } from './alertRuleFilters';
import { buildAlertRuleSearchQuery } from './alertRuleSearchQuery';

describe('buildAlertRuleSearchQuery', () => {
  it('asks for the first 40 rules by title with the fields the row shows', () => {
    expect(buildAlertRuleSearchQuery(search(createRulesApiFilter()))).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      where: undefined,
      sort: [{ field: 'title', direction: 'asc' }],
      fields: [
        'title',
        'folder',
        'paused',
        'state',
        'health',
        'lastError',
        'annotations',
        'interval',
        'labels',
        'datasourceUIDs',
        'totalsHealthy',
        'totalsFiring',
        'totalsPending',
        'totalsRecovering',
        'totalsNoData',
        'totalsError',
        'notificationType',
        'receiver',
        'routingTree',
      ],
      limit: 40,
    });
  });

  it('passes the continuation token through', () => {
    expect(buildAlertRuleSearchQuery(search(createRulesApiFilter()), 'opaque-token').continue).toBe('opaque-token');
  });

  it.each<[query: string, where: ListAlertRuleSearchRulesV0Alpha1RequestBody['where']]>([
    ['cpu "high load" rule:disk', { text: { value: 'cpu high load disk' } }],
    ['datasource:a datasource:b', { filter: { field: 'datasourceUIDs', operator: 'In', values: ['a', 'b'] } }],
    ['label:team', { filter: { field: 'labels', operator: 'In', values: ['team'] } }],
    ['label:!team', { filter: { field: 'labels', operator: 'NotIn', values: ['team'] } }],
    ['label:team=api', { filter: { field: 'labels', operator: 'In', values: ['team=api'] } }],
    ['label:team!=api', { filter: { field: 'labels', operator: 'NotIn', values: ['team=api'] } }],
    ['label:team!=', { regex: { field: 'labels', pattern: 'team=.+' } }],
    ['label:team=~api.*', { regex: { field: 'labels', pattern: 'team=api.*' } }],
    ['label:team!~api.*', { regex: { field: 'labels', pattern: 'team=api.*', negate: true } }],
    ['plugins:hide', { regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true } }],
    ['dashboard:d', { filter: { field: 'dashboardUID', operator: 'In', values: ['d'] } }],
    ['panelId:4', { filter: { field: 'panelID', operator: 'In', values: ['4'] } }],
    ['paused:true', { filter: { field: 'paused', operator: 'In', values: ['true'] } }],
    ['contactPoint:on-call', { filter: { field: 'receiver', operator: 'In', values: ['on-call'] } }],
    ['policy:escalation', { filter: { field: 'routingTree', operator: 'In', values: ['escalation'] } }],
    ['policy:default', undefined],
    ['state:firing', { filter: { field: 'state', operator: 'In', values: ['Firing'] } }],
    ['state:normal', { filter: { field: 'state', operator: 'In', values: ['Healthy', 'Inactive'] } }],
    ['health:ok', { filter: { field: 'health', operator: 'In', values: ['OK'] } }],
    ['health:nodata', { filter: { field: 'health', operator: 'In', values: ['NoData'] } }],
  ])('builds the where clause for %j', (query, where) => {
    expect(buildAlertRuleSearchQuery(search(parse(query, alertRuleSearchSchema).filter)).where).toEqual(where);
  });

  it('filters by the resolved folder UIDs, not the typed names', () => {
    expect(
      buildAlertRuleSearchQuery(search(parse('folder:Alerts', alertRuleSearchSchema).filter, ['f1', 'f2'])).where
    ).toEqual({
      filter: { field: 'folder', operator: 'In', values: ['f1', 'f2'] },
    });
  });

  it('combines several filters in one flat and', () => {
    expect(
      buildAlertRuleSearchQuery(search(parse('cpu folder:Alerts label:team', alertRuleSearchSchema).filter, ['f1']))
        .where
    ).toEqual({
      and: [
        { text: { value: 'cpu' } },
        { filter: { field: 'folder', operator: 'In', values: ['f1'] } },
        { filter: { field: 'labels', operator: 'In', values: ['team'] } },
      ],
    });
  });
});

function search<Filter extends SharedRuleFilter>(filter: Filter, folderUids: string[] = []) {
  return { filter, folderUids };
}
