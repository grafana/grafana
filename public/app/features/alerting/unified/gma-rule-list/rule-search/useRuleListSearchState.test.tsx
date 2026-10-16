import { act, getWrapper, renderHook } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { createEmptyCriteria } from './criteria';
import { useRuleListSearchState } from './useRuleListSearchState';

function renderAt(path: string) {
  return renderHook(() => useRuleListSearchState('alert'), {
    wrapper: getWrapper({ renderWithRouter: true, historyOptions: { initialEntries: [path] } }),
  });
}

describe('useRuleListSearchState', () => {
  it('SEARCH-7: defaults to Folders mode with no URL params', () => {
    const { result } = renderAt('/alerting/rules/alert');
    expect(result.current.mode).toBe('folders');
    expect(result.current.criteria).toEqual(createEmptyCriteria());
  });

  it('SEARCH-2: restores criteria and mode from the URL on load', () => {
    const { result } = renderAt('/alerting/rules/alert?search=namespace%3Afolder-1&view=list');
    expect(result.current.criteria.namespaces).toEqual(['folder-1']);
    expect(result.current.mode).toBe('list');
  });

  it('SEARCH-7: applying free text switches to List mode even when view was Folders', () => {
    const { result } = renderAt('/alerting/rules/alert?search=namespace%3Afolder-1');
    expect(result.current.mode).toBe('folders');

    act(() => {
      result.current.setCriteria({ ...result.current.criteria, text: ['cpu'] });
    });

    expect(result.current.mode).toBe('list');
    expect(new URLSearchParams(locationService.getLocation().search).get('view')).toBe('list');
  });

  it('SEARCH-7: clearing the last non-folder criterion returns to Folders and removes view from the URL', () => {
    const { result } = renderAt('/alerting/rules/alert');

    act(() => {
      result.current.setCriteria({ ...result.current.criteria, text: ['cpu'] });
    });
    expect(result.current.mode).toBe('list');

    act(() => {
      result.current.setCriteria({ ...result.current.criteria, text: [] });
    });

    expect(result.current.mode).toBe('folders');
    expect(new URLSearchParams(locationService.getLocation().search).has('view')).toBe(false);
  });

  it('SEARCH-7: clearing one of two non-folder criteria stays in List', () => {
    const { result } = renderAt('/alerting/rules/alert?search=cpu%20paused%3Atrue&view=list');

    act(() => {
      result.current.setCriteria({ ...result.current.criteria, text: [] });
    });

    expect(result.current.mode).toBe('list');
    expect(new URLSearchParams(locationService.getLocation().search).get('view')).toBe('list');
  });

  it('SEARCH-7: reset with filters applied returns to Folders', () => {
    const { result } = renderAt('/alerting/rules/alert?search=cpu&view=list');

    act(() => {
      result.current.reset();
    });

    expect(result.current.mode).toBe('folders');
    expect(locationService.getLocation().search).toBe('?search=');
  });

  it('SEARCH-7: a List chosen with no filters is kept when the folder filter changes', () => {
    const { result } = renderAt('/alerting/rules/alert?view=list');

    act(() => {
      result.current.setCriteria({ ...result.current.criteria, namespaces: ['folder-1'] });
    });

    expect(result.current.mode).toBe('list');
  });

  it('SEARCH-7: setMode("folders") is a no-op while non-folder criteria are active', () => {
    const { result } = renderAt('/alerting/rules/alert?search=cpu&view=list');
    expect(result.current.mode).toBe('list');

    act(() => {
      result.current.setMode('folders');
    });

    expect(result.current.mode).toBe('list');
  });

  it('SEARCH-7: setMode("folders") is honored once no non-folder criteria remain', () => {
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
  ])('SEARCH-7: %s switches to List mode', (_name, search) => {
    const { result } = renderAt(`/alerting/rules/alert?search=${search}`);
    expect(result.current.mode).toBe('list');
  });

  it('SEARCH-7: only a folder filter stays in Folders mode', () => {
    const { result } = renderAt('/alerting/rules/alert?search=namespace%3Afolder-1');
    expect(result.current.mode).toBe('folders');
    expect(result.current.hasNonFolderFilters).toBe(false);
  });

  it('SEARCH-1: setCriteria serializes criteria into the search URL param', () => {
    const { result } = renderAt('/alerting/rules/alert');

    act(() => {
      result.current.setCriteria({ ...result.current.criteria, namespaces: ['folder-1'], text: ['cpu'] });
    });

    expect(new URLSearchParams(locationService.getLocation().search).get('search')).toBe('namespace:folder-1 cpu');
  });

  it('SAVE-3: reset writes an empty search param, so a reload stays unfiltered', () => {
    const { result } = renderAt('/alerting/rules/alert?search=cpu');

    act(() => {
      result.current.reset();
    });

    expect(new URLSearchParams(locationService.getLocation().search).get('search')).toBe('');
  });

  it('SAVE-3: an empty search param still means Folders mode', () => {
    const { result } = renderAt('/alerting/rules/alert?search=');

    expect(result.current.mode).toBe('folders');
    expect(result.current.criteria).toEqual(createEmptyCriteria());
  });

  it('surfaces criteria issues from getCriteriaIssues (panelId without dashboard)', () => {
    const { result } = renderAt('/alerting/rules/alert?search=panelId%3A4');
    expect(result.current.issues).toEqual([{ key: 'panelId', reason: 'requiresDashboard' }]);
  });
});
