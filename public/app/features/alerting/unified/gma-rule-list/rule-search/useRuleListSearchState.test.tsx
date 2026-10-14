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
  it('SEARCH-7.1: defaults to Folders mode with no URL params', () => {
    const { result } = renderAt('/alerting/rules/alert');
    expect(result.current.mode).toBe('folders');
    expect(result.current.criteria).toEqual(createEmptyCriteria());
  });

  it('SEARCH-2.1: restores criteria and mode from the URL on load', () => {
    const { result } = renderAt('/alerting/rules/alert?search=namespace%3Afolder-1&view=list');
    expect(result.current.criteria.namespaces).toEqual(['folder-1']);
    expect(result.current.mode).toBe('list');
  });

  it('SEARCH-7.2: applying free text switches to List mode even when view was Folders', () => {
    const { result } = renderAt('/alerting/rules/alert?search=namespace%3Afolder-1');
    expect(result.current.mode).toBe('folders');

    act(() => {
      result.current.setCriteria({ ...result.current.criteria, text: ['cpu'] });
    });

    expect(result.current.mode).toBe('list');
    expect(new URLSearchParams(locationService.getLocation().search).get('view')).toBe('list');
  });

  it('SEARCH-7.3: removing the non-folder criterion again does not switch back to Folders', () => {
    const { result } = renderAt('/alerting/rules/alert');

    act(() => {
      result.current.setCriteria({ ...result.current.criteria, text: ['cpu'] });
    });
    expect(result.current.mode).toBe('list');

    act(() => {
      result.current.setCriteria({ ...result.current.criteria, text: [] });
    });

    expect(result.current.mode).toBe('list');
  });

  it('SEARCH-7.4: setMode("folders") is a no-op while non-folder criteria are active', () => {
    const { result } = renderAt('/alerting/rules/alert?search=cpu&view=list');
    expect(result.current.mode).toBe('list');

    act(() => {
      result.current.setMode('folders');
    });

    expect(result.current.mode).toBe('list');
  });

  it('SEARCH-7.5: setMode("folders") is honored once no non-folder criteria remain', () => {
    const { result } = renderAt('/alerting/rules/alert?view=list');
    expect(result.current.mode).toBe('list');

    act(() => {
      result.current.setMode('folders');
    });

    expect(result.current.mode).toBe('folders');
  });

  it('SEARCH-7.6: an ignored state: token does not switch to List mode', () => {
    const { result } = renderAt('/alerting/rules/alert?search=state%3Afiring');
    expect(result.current.mode).toBe('folders');
  });

  it('SEARCH-1.1: setCriteria serializes criteria into the search URL param', () => {
    const { result } = renderAt('/alerting/rules/alert');

    act(() => {
      result.current.setCriteria({ ...result.current.criteria, namespaces: ['folder-1'], text: ['cpu'] });
    });

    expect(new URLSearchParams(locationService.getLocation().search).get('search')).toBe('namespace:folder-1 cpu');
  });

  it('reset clears the search URL param', () => {
    const { result } = renderAt('/alerting/rules/alert?search=cpu');

    act(() => {
      result.current.reset();
    });

    expect(locationService.getLocation().search).not.toContain('search=');
  });

  it('surfaces criteria issues from getCriteriaIssues (panelId without dashboard)', () => {
    const { result } = renderAt('/alerting/rules/alert?search=panelId%3A4');
    expect(result.current.issues).toEqual([{ key: 'panelId', reason: 'requiresDashboard' }]);
  });
});
