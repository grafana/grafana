import { createMemoryHistory } from 'history';
import { skip } from 'rxjs';

import { type Scope } from '@grafana/data';
import { HistoryWrapper, locationService, setLocationService } from '@grafana/runtime';

import { ScopesApiClient } from './ScopesApiClient';
import { ScopesService } from './ScopesService';
import { ScopesDashboardsService } from './dashboards/ScopesDashboardsService';
import { ScopesSelectorService } from './selector/ScopesSelectorService';

// These tests use real services and a real location service on purpose. The bug they guard against is the order in
// which subscribers of one state change are notified, which mocked services cannot observe.

const originalLocationService = locationService;

// With the wrong order, a URL-writing consumer can keep scopes flipping forever. The cap makes that fail, not hang.
const MAX_VARIABLE_WRITES = 10;
const NO_SCOPES_VARIABLE_VALUE = 'none';

const mockScope = (name: string): Scope => ({
  metadata: { name },
  spec: { title: name, filters: [] },
});

// Every API stub resolves immediately and nothing on these paths uses timers, so one macrotask is enough for all
// pending promise chains to settle.
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

let disposers: Array<() => void> = [];

async function setup(initialUrl: string) {
  const location = new HistoryWrapper(createMemoryHistory({ initialEntries: [initialUrl] }));
  setLocationService(location);

  const apiClient = new ScopesApiClient();
  jest.spyOn(apiClient, 'fetchMultipleScopes').mockImplementation((names) => Promise.resolve(names.map(mockScope)));
  jest.spyOn(apiClient, 'fetchScope').mockImplementation((name) => Promise.resolve(mockScope(name)));
  jest.spyOn(apiClient, 'fetchScopeNode').mockResolvedValue(undefined);
  jest.spyOn(apiClient, 'fetchMultipleScopeNodes').mockResolvedValue([]);
  jest.spyOn(apiClient, 'fetchNodes').mockResolvedValue([]);
  jest.spyOn(apiClient, 'fetchDashboards').mockResolvedValue([]);
  jest.spyOn(apiClient, 'fetchScopeNavigations').mockResolvedValue([]);
  jest.spyOn(apiClient, 'fetchDefaultScope').mockResolvedValue(undefined);

  const dashboardsService = new ScopesDashboardsService(apiClient);
  const selectorService = new ScopesSelectorService(apiClient, dashboardsService);
  const service = new ScopesService(selectorService, dashboardsService, location, apiClient);
  disposers.push(() => service.cleanUp());

  // Let the URL-driven init load the scope metadata before enabling, as a dashboard mount would.
  await flushPromises();
  service.setEnabled(true);

  const urlParams = () => new URLSearchParams(location.getLocation().search);
  const appliedScopeIds = () => selectorService.state.appliedScopes.map((s) => s.scopeId);

  return { service, selectorService, dashboardsService, location, urlParams, appliedScopeIds };
}

// Stands in for a dashboard variable that depends on the scopes value, and for Scenes URL sync writing that variable
// to the URL. In Scenes, ScopesVariable itself skips URL sync, and the dependent variable writes the URL after it
// reacts. This collapses that chain into one synchronous subscriber, which is how Scenes performs the write. Like
// ScopesVariable, it ignores loading emissions unless the value is empty. Like Scenes URL sync, it writes only when
// the URL value differs.
function syncDependentVariableToUrl(service: ScopesService, location: HistoryWrapper) {
  const writes: string[] = [];
  const subscription = service.stateObservable.pipe(skip(1)).subscribe((state) => {
    if ((state.loading && state.value.length > 0) || writes.length >= MAX_VARIABLE_WRITES) {
      return;
    }
    const value = state.value.map((scope) => scope.metadata.name).join(',') || NO_SCOPES_VARIABLE_VALUE;
    if (new URLSearchParams(location.getLocation().search).get('var-x') !== value) {
      writes.push(value);
      location.partial({ 'var-x': value }, true);
    }
  });
  disposers.push(() => subscription.unsubscribe());
  return { writes };
}

describe('ScopesService URL ordering', () => {
  afterEach(() => {
    for (const dispose of disposers) {
      dispose();
    }
    disposers = [];
    setLocationService(originalLocationService);
    // Applying scopes records them as recent scopes in localStorage.
    window.localStorage.clear();
  });

  it('keeps scopes removed when a consumer writes to the URL during the removal', async () => {
    const { service, selectorService, location, urlParams, appliedScopeIds } = await setup('/d/abc?scopes=scope-x');
    const urlSync = syncDependentVariableToUrl(service, location);

    selectorService.removeAllScopes();
    await flushPromises();

    expect(appliedScopeIds()).toEqual([]);
    expect(urlParams().getAll('scopes')).toEqual([]);
    expect(urlSync.writes).toEqual([NO_SCOPES_VARIABLE_VALUE]);
  });

  it('keeps the new scope when a consumer writes to the URL during a scope change', async () => {
    const { service, location, urlParams, appliedScopeIds } = await setup('/d/abc?scopes=scope-x');
    const urlSync = syncDependentVariableToUrl(service, location);

    await service.changeScopes(['scope-y']);
    await flushPromises();

    expect(appliedScopeIds()).toEqual(['scope-y']);
    expect(urlParams().getAll('scopes')).toEqual(['scope-y']);
    // The empty value comes first because scope-y's metadata has not loaded yet when the change is applied.
    expect(urlSync.writes).toEqual([NO_SCOPES_VARIABLE_VALUE, 'scope-y']);
  });

  it('writes the removed scopes to the URL before notifying consumers', async () => {
    const { service, selectorService, urlParams } = await setup('/d/abc?scopes=scope-x');
    const urlScopesAtNotify: string[][] = [];
    const subscription = service.stateObservable
      .pipe(skip(1))
      .subscribe(() => urlScopesAtNotify.push(urlParams().getAll('scopes')));
    disposers.push(() => subscription.unsubscribe());

    selectorService.removeAllScopes();
    await flushPromises();

    expect(urlScopesAtNotify.length).toBeGreaterThan(0);
    for (const urlScopes of urlScopesAtNotify) {
      expect(urlScopes).toEqual([]);
    }
  });

  it('writes the navigation scope to the URL before notifying consumers', async () => {
    const { service, dashboardsService, urlParams } = await setup('/d/abc?scopes=scope-x');
    const notified: Array<{ drawerOpened: boolean; navigationScope: string | null }> = [];
    const subscription = service.stateObservable
      .pipe(skip(1))
      .subscribe((state) =>
        notified.push({ drawerOpened: state.drawerOpened, navigationScope: urlParams().get('navigation_scope') })
      );
    disposers.push(() => subscription.unsubscribe());

    await dashboardsService.setNavigationScope('nav-scope');

    // Setting a navigation scope opens the drawer, which is the change consumers see.
    expect(notified[0]).toEqual({ drawerOpened: true, navigationScope: 'nav-scope' });
  });
});
