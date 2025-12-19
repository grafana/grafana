import { Page, Response } from '@playwright/test';

import { ScopeDashboardBindingSpec, ScopeDashboardBindingStatus } from '@grafana/data';

import { Resource } from '../../public/app/features/apiserver/types';

import { testScopes } from './scopes';

const USE_LIVE_DATA = Boolean(process.env.API_CALLS_CONFIG_PATH);

/**
 * Sets up all scope-related API routes before navigation.
 * This ensures that ALL scope API requests (including those made during initial page load)
 * are intercepted by the mocks, preventing RTK Query from caching real API responses.
 *
 * Call this BEFORE navigating to a page (e.g., before gotoDashboardPage).
 */
export async function setupScopeRoutes(page: Page, scopes: TestScope[]): Promise<void> {
  // Route for scope node children (tree structure)
  await page.route(`**/apis/scope.grafana.app/v0alpha1/namespaces/*/find/scope_node_children*`, async (route) => {
    const url = new URL(route.request().url());
    const parentParam = url.searchParams.get('parent');
    const queryParam = url.searchParams.get('query');

    // Find the appropriate scopes based on parent
    let scopesToReturn = scopes;
    if (parentParam) {
      // Find nested scopes based on parent name
      const findChildren = (items: TestScope[]): TestScope[] => {
        for (const item of items) {
          if (item.name === parentParam && item.children) {
            return item.children;
          }
          if (item.children) {
            const found = findChildren(item.children);
            if (found.length > 0) {
              return found;
            }
          }
        }
        return [];
      };
      scopesToReturn = findChildren(scopes);
      if (scopesToReturn.length === 0) {
        scopesToReturn = scopes; // Fallback to root scopes
      }
    }

    // Filter by search query if provided
    if (queryParam) {
      const query = queryParam.toLowerCase();
      const filterByQuery = (items: TestScope[]): TestScope[] => {
        const results: TestScope[] = [];
        for (const item of items) {
          // Exact match on name or title containing the query
          if (item.name.toLowerCase() === query || item.title.toLowerCase() === query) {
            results.push(item);
          } else if (item.name.toLowerCase().includes(query) || item.title.toLowerCase().includes(query)) {
            results.push(item);
          }
          // Also search in children
          if (item.children) {
            results.push(...filterByQuery(item.children));
          }
        }
        return results;
      };
      scopesToReturn = filterByQuery(scopesToReturn);
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        apiVersion: 'scope.grafana.app/v0alpha1',
        kind: 'FindScopeNodeChildrenResults',
        metadata: {},
        items: scopesToReturn.map((scope) => ({
          kind: 'ScopeNode',
          apiVersion: 'scope.grafana.app/v0alpha1',
          metadata: {
            name: scope.name,
            namespace: 'default',
          },
          spec: {
            title: scope.title,
            description: scope.title,
            disableMultiSelect: scope.disableMultiSelect ?? false,
            nodeType: scope.children ? 'container' : 'leaf',
            ...(parentParam && { parentName: parentParam }),
            ...((scope.addLinks || scope.children) && {
              linkType: 'scope',
              linkId: `scope-${scope.name}`,
            }),
            ...(scope.redirectPath && { redirectPath: scope.redirectPath }),
          },
        })),
      }),
    });
  });

  // Route for individual scope fetching
  await page.route(`**/apis/scope.grafana.app/v0alpha1/namespaces/*/scopes/*`, async (route) => {
    const url = route.request().url();
    const scopeName = url.split('/scopes/')[1]?.split('?')[0];

    // Find the scope in the test data
    const findScope = (items: TestScope[]): TestScope | undefined => {
      for (const item of items) {
        if (`scope-${item.name}` === scopeName) {
          return item;
        }
        if (item.children) {
          const found = findScope(item.children);
          if (found) {
            return found;
          }
        }
      }
      return undefined;
    };

    const scope = findScope(scopes);

    if (scope) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'Scope',
          apiVersion: 'scope.grafana.app/v0alpha1',
          metadata: {
            name: `scope-${scope.name}`,
            namespace: 'default',
          },
          spec: {
            title: scope.title,
            description: '',
            filters: scope.filters,
            category: scope.category,
            type: scope.type,
          },
        }),
      });
    } else {
      await route.fulfill({ status: 404 });
    }
  });

  // Route for scope dashboard bindings
  await page.route(`**/apis/scope.grafana.app/v0alpha1/namespaces/*/find/scope_dashboard_bindings*`, async (route) => {
    const url = new URL(route.request().url());
    const scopeParams = url.searchParams.getAll('scope');

    const groups: string[] = ['Most relevant', 'Dashboards', 'Something else', ''];

    // Find scopes by name
    const findScope = (items: TestScope[], name: string): TestScope | undefined => {
      for (const item of items) {
        if (`scope-${item.name}` === name) {
          return item;
        }
        if (item.children) {
          const found = findScope(item.children, name);
          if (found) {
            return found;
          }
        }
      }
      return undefined;
    };

    const bindings: ScopeDashboardBinding[] = [];
    for (const scopeName of scopeParams) {
      const scope = findScope(scopes, scopeName);
      if (scope) {
        for (let i = 0; i < 10; i++) {
          const selectedGroup = groups[Math.floor(Math.random() * groups.length)];
          bindings.push({
            kind: 'ScopeDashboardBinding',
            apiVersion: 'scope.grafana.app/v0alpha1',
            metadata: {
              name: 'scope',
              resourceVersion: '1',
              creationTimestamp: 'stamp',
            },
            spec: {
              dashboard: (scope.dashboardUid ?? 'edediimbjhdz4b') + '/' + Math.random().toString(),
              scope: scopeName,
            },
            status: {
              dashboardTitle: (scope.dashboardTitle ?? 'A tall dashboard') + (selectedGroup[0] ?? 'U') + i,
              ...(selectedGroup !== '' && { groups: [selectedGroup] }),
            },
          });
        }
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        apiVersion: 'scope.grafana.app/v0alpha1',
        items: bindings,
      }),
    });
  });

  // Route for scope navigations
  await page.route(`**/apis/scope.grafana.app/v0alpha1/namespaces/*/find/scope_navigations*`, async (route) => {
    const url = new URL(route.request().url());
    const scopeParams = url.searchParams.getAll('scope');

    // Find scopes by name
    const findScope = (items: TestScope[], name: string): TestScope | undefined => {
      for (const item of items) {
        if (`scope-${item.name}` === name) {
          return item;
        }
        if (item.children) {
          const found = findScope(item.children, name);
          if (found) {
            return found;
          }
        }
      }
      return undefined;
    };

    const navigations: Array<{
      kind: string;
      apiVersion: string;
      metadata: { name: string; resourceVersion: string; creationTimestamp: string };
      spec: { url: string; scope: string };
      status: { title: string };
    }> = [];

    for (const scopeName of scopeParams) {
      const scope = findScope(scopes, scopeName);
      if (scope?.dashboardUid && scope.addLinks) {
        navigations.push({
          kind: 'ScopeNavigation',
          apiVersion: 'scope.grafana.app/v0alpha1',
          metadata: {
            name: `${scopeName}-nav`,
            resourceVersion: '1',
            creationTimestamp: 'stamp',
          },
          spec: {
            url: `/d/${scope.dashboardUid}`,
            scope: scopeName,
          },
          status: {
            title: scope.dashboardTitle ?? scope.title,
          },
        });
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        apiVersion: 'scope.grafana.app/v0alpha1',
        items: navigations,
      }),
    });
  });
}

/**
 * Clears all scope-related routes.
 * Call this before setting up new routes to ensure clean state.
 */
export async function clearScopeRoutes(page: Page): Promise<void> {
  await page.unroute(`**/apis/scope.grafana.app/v0alpha1/namespaces/*/find/scope_node_children*`);
  await page.unroute(`**/apis/scope.grafana.app/v0alpha1/namespaces/*/scopes/*`);
  await page.unroute(`**/apis/scope.grafana.app/v0alpha1/namespaces/*/find/scope_dashboard_bindings*`);
  await page.unroute(`**/apis/scope.grafana.app/v0alpha1/namespaces/*/find/scope_navigations*`);
}

/**
 * Clears the RTK Query cache for the scope API.
 * Call this when you need to invalidate cached responses (e.g., when mock data changes).
 */
export async function clearScopeApiCache(page: Page): Promise<void> {
  await page.evaluate(() => {
    // RTK Query reset action for the scope API
    const resetAction = { type: 'scopeAPIv0alpha1/resetApiState' };

    // Access Grafana's Redux store exposed on window for E2E tests
    // The store is exposed in public/app/store/store.ts via setStore()
    const store: { dispatch?: (action: { type: string }) => void } | undefined =
      // @ts-expect-error - __grafanaStore is set by Grafana for E2E testing
      window.__grafanaStore;
    if (store?.dispatch) {
      store.dispatch(resetAction);
    }
  });
}

export type TestScope = {
  name: string;
  title: string;
  children?: TestScope[];
  filters?: Array<{ key: string; value: string; operator: string }>;
  dashboardUid?: string;
  dashboardTitle?: string;
  disableMultiSelect?: boolean;
  type?: string;
  category?: string;
  addLinks?: boolean;
  redirectPath?: string;
};

type ScopeDashboardBinding = Resource<ScopeDashboardBindingSpec, ScopeDashboardBindingStatus, 'ScopeDashboardBinding'>;

/**
 * Opens the scopes selector dropdown and waits for the tree to load.
 */
export async function openScopesSelector(page: Page, scopes?: TestScope[]) {
  await page.getByTestId('scopes-selector-input').click();
  // Wait for tree items to appear (works whether data comes from network or cache)
  await page.waitForSelector('[data-testid^="scopes-tree-"]', { timeout: 5000 });
}

/**
 * Expands a scope tree node and waits for children to load.
 */
export async function expandScopesSelection(page: Page, parentScope: string, scopes?: TestScope[]) {
  const expandButton = page.getByTestId(`scopes-tree-${parentScope}-expand`);
  await expandButton.click();
  // Wait for the node to be expanded (aria-expanded="true") or for new children to appear
  await page.waitForFunction(
    (selector) => {
      const button = document.querySelector(selector);
      return button?.getAttribute('aria-expanded') === 'true';
    },
    `[data-testid="scopes-tree-${parentScope}-expand"]`,
    { timeout: 5000 }
  );
}

/**
 * Selects a scope in the tree.
 */
export async function selectScope(page: Page, scopeName: string, selectedScope?: TestScope) {
  const element = page.locator(
    `[data-testid="scopes-tree-${scopeName}-checkbox"], [data-testid="scopes-tree-${scopeName}-radio"], [data-testid="scopes-tree-${scopeName}-link"]`
  );
  await element.scrollIntoViewIfNeeded();
  await element.click({ force: true });
}

/**
 * Applies the selected scopes and waits for the selector to close and page to settle.
 */
export async function applyScopes(page: Page, scopes?: TestScope[]) {
  await page.getByTestId('scopes-selector-apply').scrollIntoViewIfNeeded();
  await page.getByTestId('scopes-selector-apply').click({ force: true });
  // Wait for the apply button to disappear (selector closed)
  await page.waitForSelector('[data-testid="scopes-selector-apply"]', { state: 'hidden', timeout: 5000 });
  // Wait for any resulting API calls (dashboard bindings, etc.) to complete
  await page.waitForLoadState('networkidle');
}

/**
 * Searches for scopes in the tree and waits for results.
 * The frontend uses a 500ms debounce, so we wait for the actual search response.
 */
export async function searchScopes(page: Page, value: string, resultScopes?: TestScope[]) {
  // Set up promise to wait for the search API response (triggered after debounce). These are not cached, so we should be good.
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/find/scope_node_children') && response.url().includes('query='),
    { timeout: 10000 }
  );

  await page.getByTestId('scopes-tree-search').fill(value);

  // Wait for the debounced search request to complete
  await responsePromise;
}

export async function getScopeTreeName(page: Page, nth: number): Promise<string> {
  const locator = page.getByTestId(/^scopes-tree-.*-expand/).nth(nth);
  const fullTestId = await locator.getAttribute('data-testid');
  const scopeName = fullTestId?.replace(/^scopes-tree-/, '').replace(/-expand$/, '');

  if (!scopeName) {
    throw new Error('There are no scopes in the selector');
  }

  return scopeName;
}

export async function getScopeLeafName(page: Page, nth: number): Promise<string> {
  const locator = page.getByTestId(/^scopes-tree-.*-(checkbox|radio|link)/).nth(nth);
  const fullTestId = await locator.getAttribute('data-testid');
  const scopeName = fullTestId?.replace(/^scopes-tree-/, '').replace(/-(checkbox|radio|link)/, '');

  if (!scopeName) {
    throw new Error('There are no scopes in the selector');
  }

  return scopeName;
}

export async function getScopeLeafTitle(page: Page, nth: number): Promise<string> {
  // Get the nth selectable tree item (checkbox, radio, or link)
  const leafLocator = page.getByTestId(/^scopes-tree-.*-(checkbox|radio|link)/).nth(nth);
  // Find the closest ancestor element that has the main tree item test id
  const titleLocator = leafLocator.locator(
    'xpath=ancestor::*[@data-testid][starts-with(@data-testid, "scopes-tree-") and not(contains(@data-testid, "-checkbox")) and not(contains(@data-testid, "-radio")) and not(contains(@data-testid, "-link")) and not(contains(@data-testid, "-expand"))]'
  );
  const scopeTitle = await titleLocator.textContent();
  if (!scopeTitle) {
    throw new Error('There are no scopes in the selector');
  }
  return scopeTitle;
}

export async function setScopes(page: Page, scopeBindingSetting?: { uid: string; title: string }) {
  const scopes = testScopes(scopeBindingSetting);
  await openScopesSelector(page, USE_LIVE_DATA ? undefined : scopes); //used only in mocked scopes version

  let scopeName = await getScopeTreeName(page, 0);

  const firstLevelScopes = scopes[0].children!; //used only in mocked scopes version
  await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : firstLevelScopes);

  scopeName = await getScopeTreeName(page, 1);

  const secondLevelScopes = firstLevelScopes[0].children!; //used only in mocked scopes version
  await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : secondLevelScopes);

  const selectedScopes = [secondLevelScopes[0]]; //used only in mocked scopes version

  scopeName = await getScopeLeafName(page, 0);
  await selectScope(page, scopeName, USE_LIVE_DATA ? undefined : selectedScopes[0]);

  await applyScopes(page, USE_LIVE_DATA ? undefined : selectedScopes); //used only in mocked scopes version
}
