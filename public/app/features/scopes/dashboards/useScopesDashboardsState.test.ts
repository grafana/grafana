import { act, renderHook } from '@testing-library/react';
import { BehaviorSubject } from 'rxjs';

import { getFeatureFlagClient } from '@grafana/runtime/internal';

import { ScopesApiClient } from '../ScopesApiClient';

import { ScopesDashboardsService, type ScopesDashboardsServiceState } from './ScopesDashboardsService';
import { type ScopeNavigation } from './types';
import {
  useDashboardsLoading,
  useDashboardsSearchQuery,
  useFilteredFolders,
  useForScopeNames,
  useGetNavigationScope,
  useScopeNavigations,
  useScopesDashboardsActions,
} from './useScopesDashboardsState';

jest.mock('../ScopesContextProvider', () => ({
  useScopesServices: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getLocation: jest.fn(() => ({ pathname: '/' })),
    getLocationObservable: jest.fn(() => ({ subscribe: jest.fn() })),
  },
}));

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: jest.fn(),
}));

const { useScopesServices } = jest.requireMock('../ScopesContextProvider');

function createState(overrides: Partial<ScopesDashboardsServiceState> = {}): ScopesDashboardsServiceState {
  return {
    drawerOpened: false,
    scopeNavigations: [],
    filteredFolders: {},
    folders: {},
    forScopeNames: [],
    loading: false,
    searchQuery: '',
    ...overrides,
  };
}

type FakeDashboardsService = Pick<
  ScopesDashboardsService,
  'changeSearchQuery' | 'clearSearchQuery' | 'updateFolder' | 'setNavigationScope' | 'stateObservable'
> & { readonly state: ScopesDashboardsServiceState };

function createService(initial: ScopesDashboardsServiceState) {
  const subject = new BehaviorSubject(initial);
  const service: FakeDashboardsService = {
    get state() {
      return subject.getValue();
    },
    stateObservable: subject.asObservable(),
    changeSearchQuery: jest.fn(),
    clearSearchQuery: jest.fn(),
    updateFolder: jest.fn(),
    setNavigationScope: jest.fn(),
  };
  return { subject, service };
}

function provide(service: FakeDashboardsService | ScopesDashboardsService) {
  useScopesServices.mockReturnValue({ scopesDashboardsService: service });
}

describe('useScopesDashboardsState hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes each field of the service state through unchanged', () => {
    const state = createState({
      loading: true,
      forScopeNames: ['a'],
      searchQuery: 'q',
      filteredFolders: { '': { title: '', expanded: true, folders: {}, suggestedNavigations: {} } },
    });
    provide(createService(state).service);

    expect(renderHook(() => useDashboardsLoading()).result.current).toBe(true);
    expect(renderHook(() => useForScopeNames()).result.current).toBe(state.forScopeNames);
    expect(renderHook(() => useScopeNavigations()).result.current).toBe(state.scopeNavigations);
    expect(renderHook(() => useFilteredFolders()).result.current).toBe(state.filteredFolders);
    expect(renderHook(() => useDashboardsSearchQuery()).result.current).toBe('q');
  });

  it('updates when the field it reads changes', () => {
    const { service, subject } = createService(createState());
    provide(service);
    const { result } = renderHook(() => useForScopeNames());
    expect(result.current).toEqual([]);

    act(() => subject.next(createState({ forScopeNames: ['a', 'b'] })));

    expect(result.current).toEqual(['a', 'b']);
  });

  it('does not rerender when a different field changes', () => {
    const state = createState();
    const { service, subject } = createService(state);
    provide(service);
    let renders = 0;
    renderHook(() => {
      renders++;
      return useForScopeNames();
    });
    const rendersAfterMount = renders;

    act(() => subject.next({ ...state, drawerOpened: true, loading: true, searchQuery: 'x' }));

    expect(renders).toBe(rendersAfterMount);
  });

  it('keeps the previous navigations while the new scope names are loading', () => {
    const navigations: ScopeNavigation[] = [];
    const { service, subject } = createService(createState({ forScopeNames: ['a'], scopeNavigations: navigations }));
    provide(service);
    const { result } = renderHook(() => ({
      loading: useDashboardsLoading(),
      names: useForScopeNames(),
      navigations: useScopeNavigations(),
    }));

    act(() => subject.next({ ...subject.getValue(), forScopeNames: ['b'], loading: true }));

    expect(result.current.loading).toBe(true);
    expect(result.current.names).toEqual(['b']);
    expect(result.current.navigations).toBe(navigations);
  });

  it('stops listening when it unmounts', () => {
    const { service, subject } = createService(createState());
    provide(service);
    const { unmount } = renderHook(() => useDashboardsLoading());
    expect(subject.observed).toBe(true);

    unmount();

    expect(subject.observed).toBe(false);
  });

  it('returns the defaults when the services are not available', () => {
    useScopesServices.mockReturnValue(undefined);

    expect(renderHook(() => useDashboardsLoading()).result.current).toBe(false);
    expect(renderHook(() => useForScopeNames()).result.current).toEqual([]);
    expect(renderHook(() => useScopeNavigations()).result.current).toEqual([]);
    expect(renderHook(() => useFilteredFolders()).result.current).toEqual({});
    expect(renderHook(() => useDashboardsSearchQuery()).result.current).toBe('');
  });

  it('returns the defaults when the service is only partly provided', () => {
    useScopesServices.mockReturnValue({ scopesDashboardsService: { toggleDrawer: jest.fn() } });
    expect(renderHook(() => useDashboardsLoading()).result.current).toBe(false);

    useScopesServices.mockReturnValue({
      scopesDashboardsService: { state: undefined, stateObservable: new BehaviorSubject(undefined) },
    });
    expect(renderHook(() => useForScopeNames()).result.current).toEqual([]);
  });

  it('returns the same default value on every render', () => {
    useScopesServices.mockReturnValue(undefined);
    const { result, rerender } = renderHook(() => useForScopeNames());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  describe('with the real service', () => {
    const navigation: ScopeNavigation = {
      metadata: { name: 'nav' },
      spec: { scope: 'a', url: '/d/one' },
      status: { title: 'One', groups: ['group'] },
    };

    it('rerenders the folder tree when a folder is expanded in place', async () => {
      (getFeatureFlagClient as jest.Mock).mockReturnValue({ getBooleanValue: () => false });
      const apiClient = new ScopesApiClient();
      jest.spyOn(apiClient, 'fetchScopeNavigations').mockResolvedValue([navigation]);
      const service = new ScopesDashboardsService(apiClient);
      provide(service);
      await service.fetchDashboards(['a']);
      const { result } = renderHook(() => useFilteredFolders());
      const before = result.current;
      expect(before[''].folders['group'].expanded).toBe(false);

      act(() => service.updateFolder(['', 'group'], true));

      expect(result.current).not.toBe(before);
      expect(result.current[''].folders['group'].expanded).toBe(true);
    });
  });

  describe('useScopesDashboardsActions', () => {
    it('calls the service methods with the same arguments', () => {
      const { service } = createService(createState());
      provide(service);
      const { result } = renderHook(() => useScopesDashboardsActions());

      result.current.changeSearchQuery('abc');
      result.current.clearSearchQuery();
      result.current.updateFolder(['', 'f'], true);

      expect(service.changeSearchQuery).toHaveBeenCalledWith('abc');
      expect(service.clearSearchQuery).toHaveBeenCalledTimes(1);
      expect(service.updateFolder).toHaveBeenCalledWith(['', 'f'], true);
    });

    it('resolves setNavigationScope only after the service promise settles', async () => {
      const { service } = createService(createState());
      let finish: () => void = () => {};
      jest.mocked(service.setNavigationScope).mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      provide(service);
      const { result } = renderHook(() => useScopesDashboardsActions());

      let settled = false;
      const pending = result.current.setNavigationScope('scope', ['p']).then(() => (settled = true));
      await Promise.resolve();
      expect(settled).toBe(false);
      expect(service.setNavigationScope).toHaveBeenCalledWith('scope', undefined, ['p']);

      finish();
      await pending;
      expect(settled).toBe(true);
    });

    it('looks the method up when it is called, so a replaced method is used', () => {
      const { service } = createService(createState());
      provide(service);
      const { result } = renderHook(() => useScopesDashboardsActions());
      const replacement = jest.fn();
      service.updateFolder = replacement;

      result.current.updateFolder(['', 'f'], false);

      expect(replacement).toHaveBeenCalledWith(['', 'f'], false);
    });

    it('keeps its identity across renders and does nothing without the service', async () => {
      const { service } = createService(createState());
      provide(service);
      const { result, rerender } = renderHook(() => useScopesDashboardsActions());
      const first = result.current;
      rerender();
      expect(result.current).toBe(first);

      useScopesServices.mockReturnValue(undefined);
      const { result: detached } = renderHook(() => useScopesDashboardsActions());
      expect(() => detached.current.changeSearchQuery('x')).not.toThrow();
      await expect(detached.current.setNavigationScope('x')).resolves.toBeUndefined();
    });

    it('does nothing when the service lacks the method', async () => {
      useScopesServices.mockReturnValue({ scopesDashboardsService: {} });
      const { result } = renderHook(() => useScopesDashboardsActions());

      expect(() => result.current.changeSearchQuery('x')).not.toThrow();
      expect(() => result.current.clearSearchQuery()).not.toThrow();
      expect(() => result.current.updateFolder(['', 'f'], true)).not.toThrow();
      await expect(result.current.setNavigationScope('x')).resolves.toBeUndefined();
    });
  });

  describe('useGetNavigationScope', () => {
    it('reads the values at call time without rerendering on change', () => {
      const { service, subject } = createService(createState({ navigationScope: 'one', navScopePath: ['a'] }));
      provide(service);
      let renders = 0;
      const { result } = renderHook(() => {
        renders++;
        return useGetNavigationScope();
      });
      const rendersAfterMount = renders;
      expect(result.current()).toEqual({ navigationScope: 'one', navScopePath: ['a'] });

      act(() => subject.next({ ...subject.getValue(), navigationScope: 'two', navScopePath: ['b'] }));

      expect(result.current()).toEqual({ navigationScope: 'two', navScopePath: ['b'] });
      expect(renders).toBe(rendersAfterMount);
    });

    it('returns undefined values when the service is not available', () => {
      useScopesServices.mockReturnValue(undefined);
      const { result } = renderHook(() => useGetNavigationScope());

      expect(result.current()).toEqual({ navigationScope: undefined, navScopePath: undefined });
    });
  });
});
