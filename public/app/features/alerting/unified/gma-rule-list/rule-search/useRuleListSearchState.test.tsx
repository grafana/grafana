import { act, getWrapper, renderHook } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { type RuleKind } from '../shared/ruleKind';

import { createEmptyFilter } from './ruleSearchFilter';
import { useRuleListSearchState } from './useRuleListSearchState';

function renderAt(search: string, kind: RuleKind = 'alert') {
  return renderHook(() => useRuleListSearchState(kind), {
    wrapper: getWrapper({ renderWithRouter: true, historyOptions: { initialEntries: [`/rules${search}`] } }),
  });
}

describe('useRuleListSearchState', () => {
  it("reads the search parameter with the Alert rules page's filters", () => {
    const { result } = renderAt(`?${new URLSearchParams({ search: 'state:bogus metric:cpu  folder:f1' })}`);

    expect(result.current.query).toBe('state:bogus metric:cpu  folder:f1');
    expect(result.current.filter).toEqual({
      ...createEmptyFilter(),
      folders: ['f1'],
      text: ['metric:cpu'],
    });
    expect(result.current.parseIssues).toEqual([{ key: 'state', reason: 'invalid' }]);
  });

  it("reads the search parameter with the Recording rules page's filters", () => {
    const { result } = renderAt('?search=metric%3Acpu', 'recording');

    expect(result.current.filter).toEqual({ ...createEmptyFilter(), metric: 'cpu' });
  });

  it('writes an applied query as typed and keeps the other parameters', () => {
    const { result } = renderAt('?view=folders');

    act(() => result.current.applyQuery('"high load"   folder:f1'));

    expect(locationService.getSearchObject()).toEqual({ view: 'folders', search: '"high load"   folder:f1' });
    expect(result.current.query).toBe('"high load"   folder:f1');
  });

  it('adds no history entry when the applied query is applied again', () => {
    const { result } = renderAt('?search=cpu');
    const entries = locationService.getHistory().length;

    act(() => result.current.applyQuery('cpu'));

    expect(locationService.getHistory().length).toBe(entries);
  });

  it('writes an empty search parameter for an empty query, rather than removing it', () => {
    const { result } = renderAt('?search=cpu');

    act(() => result.current.applyQuery(''));

    expect(locationService.getLocation().search).toBe('?search=');
  });
});
