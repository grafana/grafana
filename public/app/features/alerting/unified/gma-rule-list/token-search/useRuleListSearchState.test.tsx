import { act, getWrapper, renderHook } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { createEmptyFilter } from './ruleSearchFilter';
import { useRuleListSearchState } from './useRuleListSearchState';

function renderAt(path: string) {
  return renderHook(() => useRuleListSearchState('alert'), {
    wrapper: getWrapper({ renderWithRouter: true, historyOptions: { initialEntries: [path] } }),
  });
}

describe('useRuleListSearchState', () => {
  it('defaults to Folders mode with no URL params', () => {
    const { result } = renderAt('/alerting/rules/alert');
    expect(result.current.mode).toBe('folders');
    expect(result.current.filter).toEqual(createEmptyFilter());
  });

  it('restores filter and mode from the URL on load', () => {
    const { result } = renderAt('/alerting/rules/alert?search=namespace%3Afolder-1&view=list');
    expect(result.current.filter.namespaces).toEqual(['folder-1']);
    expect(result.current.mode).toBe('list');
  });

  it('applying free text switches to List mode even when view was Folders', () => {
    const { result } = renderAt('/alerting/rules/alert?search=namespace%3Afolder-1');
    expect(result.current.mode).toBe('folders');

    act(() => {
      result.current.setFilter({ ...result.current.filter, text: ['cpu'] });
    });

    expect(result.current.mode).toBe('list');
    expect(new URLSearchParams(locationService.getLocation().search).get('view')).toBe('list');
  });

  it('clearing the last non-folder criterion returns to Folders and removes view from the URL', () => {
    const { result } = renderAt('/alerting/rules/alert');

    act(() => {
      result.current.setFilter({ ...result.current.filter, text: ['cpu'] });
    });
    expect(result.current.mode).toBe('list');

    act(() => {
      result.current.setFilter({ ...result.current.filter, text: [] });
    });

    expect(result.current.mode).toBe('folders');
    expect(new URLSearchParams(locationService.getLocation().search).has('view')).toBe(false);
  });

  it('clearing one of two non-folder filters stays in List', () => {
    const { result } = renderAt('/alerting/rules/alert?search=cpu%20paused%3Atrue&view=list');

    act(() => {
      result.current.setFilter({ ...result.current.filter, text: [] });
    });

    expect(result.current.mode).toBe('list');
    expect(new URLSearchParams(locationService.getLocation().search).get('view')).toBe('list');
  });

  it('reset returns to Folders and writes an empty search param so a reload stays unfiltered', () => {
    const { result } = renderAt('/alerting/rules/alert?search=cpu&view=list');

    act(() => {
      result.current.reset();
    });

    expect(result.current.mode).toBe('folders');
    // An empty search param, not a missing one, keeps a reload unfiltered instead of re-applying the default saved search.
    expect(locationService.getLocation().search).toBe('?search=');
  });

  it('a List chosen with no filters is kept when the folder filter changes', () => {
    const { result } = renderAt('/alerting/rules/alert?view=list');

    act(() => {
      result.current.setFilter({ ...result.current.filter, namespaces: ['folder-1'] });
    });

    expect(result.current.mode).toBe('list');
  });

  it('setMode("folders") is a no-op while non-folder filters are active', () => {
    const { result } = renderAt('/alerting/rules/alert?search=cpu&view=list');
    expect(result.current.mode).toBe('list');

    act(() => {
      result.current.setMode('folders');
    });

    expect(result.current.mode).toBe('list');
  });

  it('setMode("folders") is honored once no non-folder filters remain', () => {
    const { result } = renderAt('/alerting/rules/alert?view=list');
    expect(result.current.mode).toBe('list');

    act(() => {
      result.current.setMode('folders');
    });

    expect(result.current.mode).toBe('folders');
  });

  it.each([
    ['a state token', 'state%3Afiring'],
    ['a health token', 'health%3Aerror'],
    ['a token the page does not support', 'foo%3Abar'],
  ])('%s switches to List mode', (_name, search) => {
    const { result } = renderAt(`/alerting/rules/alert?search=${search}`);
    expect(result.current.mode).toBe('list');
  });

  it('only a folder filter stays in Folders mode', () => {
    const { result } = renderAt('/alerting/rules/alert?search=namespace%3Afolder-1');
    expect(result.current.mode).toBe('folders');
    expect(result.current.hasNonFolderFilters).toBe(false);
  });

  it('setFilter serializes the filter into the search URL param', () => {
    const { result } = renderAt('/alerting/rules/alert');

    act(() => {
      result.current.setFilter({ ...result.current.filter, namespaces: ['folder-1'], text: ['cpu'] });
    });

    expect(new URLSearchParams(locationService.getLocation().search).get('search')).toBe('namespace:folder-1 cpu');
  });

  it('an empty search param still means Folders mode', () => {
    const { result } = renderAt('/alerting/rules/alert?search=');

    expect(result.current.mode).toBe('folders');
    expect(result.current.filter).toEqual(createEmptyFilter());
  });

  it('surfaces filter issues from getFilterIssues (panelId without dashboard)', () => {
    const { result } = renderAt('/alerting/rules/alert?search=panelId%3A4');
    expect(result.current.issues).toEqual([{ key: 'panelId', reason: 'requiresDashboard' }]);
  });
});
