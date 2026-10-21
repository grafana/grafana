import { act, getWrapper, renderHook } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { type RuleKind } from '../shared/ruleKind';

import { type FilterIssue } from './filterIssues';
import { type RuleSearchFilter, createEmptyFilter } from './ruleSearchFilter';
import { useRuleListSearchState } from './useRuleListSearchState';

function renderAt(path: string, kind: RuleKind = 'alert') {
  return renderHook(() => useRuleListSearchState(kind), {
    wrapper: getWrapper({ renderWithRouter: true, historyOptions: { initialEntries: [path] } }),
  });
}

function currentSearch() {
  return locationService.getLocation().search;
}

describe('useRuleListSearchState', () => {
  it('starts with an empty filter and no issues when the URL has no search parameter', () => {
    const { result } = renderAt('/alerting/rules/alert');

    expect(result.current.filter).toEqual(createEmptyFilter());
    expect(result.current.issues).toEqual([]);
  });

  it('restores the filter from the search parameter on load', () => {
    const { result } = renderAt('/alerting/rules/alert?search=cpu%20folder%3Afolder-1%20label%3Ateam%3Dapi');

    expect(result.current.filter).toEqual({
      ...createEmptyFilter(),
      text: ['cpu'],
      folders: ['folder-1'],
      labels: [{ key: 'team', operator: 'equal', value: 'api' }],
    });
  });

  it('writes the canonical form of the applied query to the search parameter and keeps other parameters', () => {
    const { result } = renderAt('/alerting/rules/alert?view=folders');

    act(() => {
      result.current.applyQuery('"high load"   folder:folder-1');
    });

    expect(new URLSearchParams(currentSearch()).get('search')).toBe('folder:folder-1 "high load"');
    expect(new URLSearchParams(currentSearch()).get('view')).toBe('folders');
    expect(result.current.query).toBe('folder:folder-1 "high load"');
    expect(result.current.filter.folders).toEqual(['folder-1']);
  });

  it('returns the canonical form of a hand-written search parameter as the query', () => {
    const { result } = renderAt('/alerting/rules/alert?search=label%3Ateam%3Dapi%20%20cpu%20folder%3Af1');

    expect(result.current.query).toBe('folder:f1 label:team=api cpu');
  });

  it('writes an empty search parameter for an empty query, so a reload stays unfiltered', () => {
    const { result } = renderAt('/alerting/rules/alert?search=cpu');

    act(() => {
      result.current.applyQuery('');
    });

    expect(currentSearch()).toBe('?search=');
    expect(result.current.filter).toEqual(createEmptyFilter());
  });

  it('reports the issues of the filter in the URL', () => {
    const { result } = renderAt('/alerting/rules/alert?search=panelId%3A4%20state%3Abogus');

    expect(result.current.issues).toEqual([
      { key: 'state', reason: 'unsupported' },
      { key: 'panelId', reason: 'requiresDashboard' },
    ]);
  });

  it.each<{ kind: RuleKind; filter: RuleSearchFilter; issues: FilterIssue[] }>([
    {
      kind: 'alert',
      filter: { ...createEmptyFilter(), text: ['metric:cpu_usage'] },
      issues: [],
    },
    { kind: 'recording', filter: { ...createEmptyFilter(), metric: 'cpu_usage' }, issues: [] },
  ])(
    'reads metric: as title text on the alert page and as a metric filter on the recording page ($kind)',
    ({ kind, filter, issues }) => {
      const { result } = renderAt('/alerting/rules?search=metric%3Acpu_usage', kind);

      expect(result.current.filter).toEqual(filter);
      expect(result.current.issues).toEqual(issues);
    }
  );
});
