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
    const { result } = renderAt('?tab=active');

    act(() => result.current.applyQuery('"high load"   folder:f1'));

    expect(locationService.getSearchObject()).toEqual({
      tab: 'active',
      search: '"high load"   folder:f1',
    });
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

describe('useRuleListSearchState view mode', () => {
  it.each([
    ['', 'folders'],
    ['?view=list', 'list'],
    ['?search=folder%3Af1', 'folders'],
    ['?search=folder%3Af1&view=list', 'list'],
    ['?search=cpu', 'list'],
    ['?search=paused%3Atrue&view=folders', 'list'],
    // A token that does not parse still counts as the filter the user typed.
    ['?search=state%3Abogus', 'list'],
    ['?search=folder%3Af*', 'folders'],
  ])('opens %j in %s mode', (search, mode) => {
    const { result } = renderAt(search);

    expect(result.current.mode).toBe(mode);
  });

  it('switches to List without writing view when a non-folder filter is applied', () => {
    const { result } = renderAt('?search=folder%3Af1');

    act(() => result.current.applyQuery('folder:f1 label:team=api'));

    expect(locationService.getSearchObject()).toEqual({ search: 'folder:f1 label:team=api' });
    expect(result.current.mode).toBe('list');
  });

  it('returns to Folders, keeping the folder filter, when the last non-folder filter is cleared', () => {
    const { result } = renderAt('?search=folder%3Af1%20cpu');

    act(() => result.current.applyQuery('folder:f1'));

    expect(locationService.getSearchObject()).toEqual({ search: 'folder:f1' });
    expect(result.current.mode).toBe('folders');
  });

  it('keeps a chosen List mode when a folder-only query is applied', () => {
    const { result } = renderAt('?view=list');

    act(() => result.current.applyQuery('folder:f1'));

    expect(locationService.getSearchObject()).toEqual({ search: 'folder:f1', view: 'list' });
  });

  it('keeps a chosen List mode when the last non-folder filter is cleared', () => {
    const { result } = renderAt('?search=cpu&view=list');

    act(() => result.current.applyQuery(''));

    expect(locationService.getSearchObject()).toEqual({ search: '', view: 'list' });
    expect(result.current.mode).toBe('list');
  });

  it('writes view=list for List and removes view for Folders', () => {
    const { result } = renderAt('?search=folder%3Af1');

    act(() => result.current.setMode('list'));
    expect(locationService.getSearchObject()).toEqual({ search: 'folder:f1', view: 'list' });

    act(() => result.current.setMode('folders'));
    expect(locationService.getSearchObject()).toEqual({ search: 'folder:f1' });
  });
});
