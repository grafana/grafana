import { alertFilters } from './alertFilters';
import { parse } from './parser';
import { recordingFilters } from './recordingFilters';
import { type RuleSearchFilter, createEmptyFilter } from './ruleSearchFilter';

const FILTERS_BY_PAGE = { Alert: alertFilters, Recording: recordingFilters };
type Page = keyof typeof FILTERS_BY_PAGE;

/** Rows that name no page are read on the Alert page. */
function onAlertPageByDefault<Row extends { page?: Page }>(rows: Row[]): Array<Row & { page: Page }> {
  return rows.map((row) => ({ ...row, page: row.page ?? 'Alert' }));
}

describe('parse', () => {
  it.each(
    onAlertPageByDefault<{ input: string; page?: Page; expected: Partial<RuleSearchFilter> }>([
      { input: '', expected: {} },
      { input: '   ', expected: {} },
      { input: 'cpu', expected: { text: ['cpu'] } },
      { input: '  cpu   high ', expected: { text: ['cpu', 'high'] } },
      { input: '"cpu high"', expected: { text: ['cpu high'] } },
      { input: '"http:500"', expected: { text: ['http:500'] } },
      { input: '1:2:3', expected: { text: ['1:2:3'] } },
      { input: '""', expected: {} },
      { input: 'rule:cpu', expected: { text: ['cpu'] } },
      // A key the page has no filter for is part of a title.
      { input: 'foo:bar', expected: { text: ['foo:bar'] } },
      { input: 'cpu is:paused', expected: { text: ['cpu', 'is:paused'] } },
      { input: 'foo:"a b"', expected: { text: ['foo:a b'] } },
      { input: 'foo:', expected: { text: ['foo:'] } },
      { input: 'metric:cpu_usage', expected: { text: ['metric:cpu_usage'] } },
      { input: 'targetDatasource:ds-2', expected: { text: ['targetDatasource:ds-2'] } },
      { input: 'state:firing', page: 'Recording', expected: { text: ['state:firing'] } },
      { input: 'dashboard:dash-1 panelId:4', page: 'Recording', expected: { text: ['dashboard:dash-1', 'panelId:4'] } },
      { input: 'paused:true', page: 'Recording', expected: { text: ['paused:true'] } },
      { input: 'cpu rule:"high load"', expected: { text: ['cpu', 'high load'] } },
      { input: 'folder:f1 folder:f2', expected: { folders: ['f1', 'f2'] } },
      { input: 'folder:"My Folder"', expected: { folders: ['My Folder'] } },
      { input: 'datasource:ds-1 datasource:ds-2', expected: { dataSourceUids: ['ds-1', 'ds-2'] } },
      { input: 'label:team', expected: { labels: [{ key: 'team', operator: 'exists' }] } },
      { input: 'label:!team', expected: { labels: [{ key: 'team', operator: 'absent' }] } },
      { input: 'label:team=api', expected: { labels: [{ key: 'team', operator: 'equal', value: 'api' }] } },
      { input: 'label:team=', expected: { labels: [{ key: 'team', operator: 'equal', value: '' }] } },
      { input: 'label:team!=api', expected: { labels: [{ key: 'team', operator: 'notEqual', value: 'api' }] } },
      { input: 'label:team=~api.*', expected: { labels: [{ key: 'team', operator: 'regex', value: 'api.*' }] } },
      { input: 'label:team!~api.*', expected: { labels: [{ key: 'team', operator: 'notRegex', value: 'api.*' }] } },
      {
        input: 'label:"team=api platform"',
        expected: { labels: [{ key: 'team', operator: 'equal', value: 'api platform' }] },
      },
      { input: 'plugins:hide', expected: { hidePluginRules: true } },
      { input: 'health:ok', expected: { health: 'ok' } },
      { input: 'health:ERROR', expected: { health: 'error' } },
      { input: 'health:NoData', expected: { health: 'nodata' } },
      { input: 'state:Firing', expected: { state: 'firing' } },
      { input: 'state:NORMAL', expected: { state: 'normal' } },
      { input: 'dashboard:dash-1 panelId:4', expected: { dashboardUid: 'dash-1', panelId: '4' } },
      { input: 'contactPoint:"on call"', expected: { contactPoint: 'on call' } },
      { input: 'policy:escalation', expected: { policy: 'escalation' } },
      { input: 'policy:default', expected: { policy: 'default' } },
      // The default routing tree's emitted name selects the default policy, never a named tree.
      { input: 'policy:user-defined', expected: { policy: 'default' } },
      { input: 'paused:true', expected: { paused: 'true' } },
      { input: 'paused:false', expected: { paused: 'false' } },
      { input: 'paused:TRUE', expected: { paused: 'true' } },
      { input: 'metric:cpu_usage', page: 'Recording', expected: { metric: 'cpu_usage' } },
      { input: 'targetDatasource:ds-2', page: 'Recording', expected: { targetDataSourceUid: 'ds-2' } },
      { input: 'health:ok', page: 'Recording', expected: { health: 'ok' } },
    ])
  )('reads $input on the $page page', ({ input, page, expected }) => {
    expect(parse(input, FILTERS_BY_PAGE[page])).toEqual({ ...createEmptyFilter(), ...expected });
  });

  it.each(
    onAlertPageByDefault<{ input: string; page?: Page; invalid: Array<{ key: string; raw: string }> }>([
      { input: 'label:', invalid: [{ key: 'label', raw: 'label:' }] },
      { input: 'rule:', invalid: [{ key: 'rule', raw: 'rule:' }] },
      { input: 'folder:""', invalid: [{ key: 'folder', raw: 'folder:""' }] },
      { input: 'label:=api', invalid: [{ key: 'label', raw: 'label:=api' }] },
      { input: 'label:!', invalid: [{ key: 'label', raw: 'label:!' }] },
      { input: 'folder:"My Fol', invalid: [{ key: 'folder', raw: 'folder:"My Fol' }] },
      { input: 'paused:maybe', invalid: [{ key: 'paused', raw: 'paused:maybe' }] },
      { input: 'plugins:show', invalid: [{ key: 'plugins', raw: 'plugins:show' }] },
      { input: 'state:bogus', invalid: [{ key: 'state', raw: 'state:bogus' }] },
      { input: 'state:error', invalid: [{ key: 'state', raw: 'state:error' }] },
      { input: 'state:inactive', invalid: [{ key: 'state', raw: 'state:inactive' }] },
      { input: 'health:err', invalid: [{ key: 'health', raw: 'health:err' }] },
      { input: 'health:great', invalid: [{ key: 'health', raw: 'health:great' }] },
    ])
  )('keeps $input as an invalid token on the $page page', ({ input, page, invalid }) => {
    expect(parse(input, FILTERS_BY_PAGE[page])).toEqual({ ...createEmptyFilter(), invalid });
  });

  it('applies the valid tokens of a mixed query and keeps each invalid one as written', () => {
    expect(parse('cpu foo:bar folder:f1 label: label:team=api state:bogus', alertFilters)).toEqual({
      ...createEmptyFilter(),
      text: ['cpu', 'foo:bar'],
      folders: ['f1'],
      labels: [{ key: 'team', operator: 'equal', value: 'api' }],
      invalid: [
        { key: 'label', raw: 'label:' },
        { key: 'state', raw: 'state:bogus' },
      ],
    });
  });

  it.each([
    { input: 'dashboard:one dashboard:two', expected: { dashboardUid: 'one' }, raw: 'dashboard:two' },
    { input: 'state:firing state:normal', expected: { state: 'firing' }, raw: 'state:normal' },
    { input: 'paused:true paused:true', expected: { paused: 'true' }, raw: 'paused:true' },
    { input: 'rule:cpu rule:disk', expected: { text: ['cpu'] }, raw: 'rule:disk' },
  ] as const)('keeps the first $input value and marks the repeat invalid', ({ input, expected, raw }) => {
    const key = raw.split(':')[0];
    expect(parse(input, alertFilters)).toEqual({ ...createEmptyFilter(), ...expected, invalid: [{ key, raw }] });
  });

  it('does not count an invalid first value as applied, so a valid repeat still applies', () => {
    expect(parse('state:bogus state:firing', alertFilters)).toEqual({
      ...createEmptyFilter(),
      state: 'firing',
      invalid: [{ key: 'state', raw: 'state:bogus' }],
    });
  });
});
