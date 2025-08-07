import { Page, Response } from '@playwright/test';

export type TestScope = {
  name: string;
  title: string;
  children?: TestScope[];
  filters?: Array<{ key: string; value: string; operator: string }>;
  dashboardUid?: string;
  dashboardTitle?: string;
  disableMultiSelect?: boolean;
  addLinks?: boolean;
};

export async function scopeNodeChildrenRequest(
  page: Page,
  scopes: TestScope[],
  parentName?: string
): Promise<Response> {
  await page.route(`**/apis/scope.grafana.app/v0alpha1/namespaces/*/find/scope_node_children*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        apiVersion: 'scope.grafana.app/v0alpha1',
        kind: 'FindScopeNodeChildrenResults',
        metadata: {},
        items: scopes.map((scope) => ({
          kind: 'ScopeNode',
          apiVersion: 'scope.grafana.app/v0alpha1',
          metadata: {
            name: `${scope.name}`,
            namespace: 'default',
          },
          spec: {
            title: scope.title,
            description: scope.title,
            disableMultiSelect: scope.disableMultiSelect ?? false,
            nodeType: scope.children ? 'container' : 'leaf',
            ...(parentName && {
              parentName,
            }),
            ...(scope.addLinks && {
              linkType: 'scope',
              linkId: `scope-${scope.name}`,
            }),
          },
        })),
      }),
    });
  });

  return page.waitForResponse((response) => response.url().includes(`/find/scope_node_children`));
}

export async function openScopesSelector(page: Page, scopes?: TestScope[]) {
  const click = async () => await page.getByTestId('scopes-selector-input').click();

  if (!scopes) {
    await click();
    return;
  }

  const responsePromise = scopeNodeChildrenRequest(page, scopes);

  await click();
  await responsePromise;
}

export async function expandScopesSelection(page: Page, parentScope: string, scopes?: TestScope[]) {
  const click = async () => await page.getByTestId(`scopes-tree-${parentScope}-expand`).click();

  if (!scopes) {
    await click();
    return;
  }

  const responsePromise = scopeNodeChildrenRequest(page, scopes, parentScope);

  await click();
  await responsePromise;
}

export async function scopeSelectRequest(page: Page, selectedScope: TestScope): Promise<Response> {
  await page.route(
    `**/apis/scope.grafana.app/v0alpha1/namespaces/*/scopes/scope-${selectedScope.name}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'Scope',
          apiVersion: 'scope.grafana.app/v0alpha1',
          metadata: {
            name: `scope-${selectedScope.name}`,
            namespace: 'default',
          },
          spec: {
            title: selectedScope.title,
            description: '',
            filters: selectedScope.filters,
          },
        }),
      });
    }
  );

  return page.waitForResponse((response) => response.url().includes(`/scopes/scope-${selectedScope.name}`));
}

export async function selectScope(page: Page, scopeName: string, selectedScope?: TestScope) {
  const click = async () => {
    const element = page.locator(
      `[data-testid="scopes-tree-${scopeName}-checkbox"], [data-testid="scopes-tree-${scopeName}-radio"]`
    );
    await element.scrollIntoViewIfNeeded();
    await element.click({ force: true });
  };

  if (!selectedScope) {
    await click();
    return;
  }

  const responsePromise = scopeSelectRequest(page, selectedScope);

  await click();
  await responsePromise;
}

export async function applyScopes(page: Page, scopes?: TestScope[]) {
  const click = async () => {
    await page.getByTestId('scopes-selector-apply').scrollIntoViewIfNeeded();
    await page.getByTestId('scopes-selector-apply').click({ force: true });
  };

  if (!scopes) {
    await click();
    return;
  }

  const url: string =
    '**/apis/scope.grafana.app/v0alpha1/namespaces/*/find/scope_dashboard_bindings?' +
    scopes.map((scope) => `scope=scope-${scope.name}`).join('&');

  await page.route(url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        apiVersion: 'scope.grafana.app/v0alpha1',
        items: scopes.map((scope) => {
          return {
            kind: 'ScopeDashboardBinding',
            apiVersion: 'scope.grafana.app/v0alpha1',
            metadata: {},
            spec: {
              dashboard: scope.dashboardUid ?? 'edediimbjhdz4b',
              scope: `scope-${scope.name}`,
            },
            status: {
              dashboardTitle: scope.dashboardTitle ?? 'A tall dashboard',
              groups: ['Dashboards'],
            },
          };
        }),
      }),
    });
  });

  const responsePromise = page.waitForResponse((response) => response.url().includes(`/find/scope_dashboard_bindings`));
  const x: Array<Promise<Response>> = [];

  for (const scope of scopes) {
    x.push(scopeSelectRequest(page, scope));
  }

  await click();
  await responsePromise;
  await Promise.all(x);
}

export async function searchScopes(page: Page, resultScopes: TestScope[], value: string) {
  const click = async () => await page.getByTestId('scopes-tree-search').fill(value);

  if (USE_LIVE_DATA) {
    await click();
    return;
  }

  const responsePromise = scopeNodeChildrenRequest(page, resultScopes);

  await click();
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
  const locator = page.getByTestId(/^scopes-tree-.*-(checkbox|radio)/).nth(nth);
  const fullTestId = await locator.getAttribute('data-testid');
  const scopeName = fullTestId?.replace(/^scopes-tree-/, '').replace(/-(checkbox|radio)/, '');

  if (!scopeName) {
    throw new Error('There are no scopes in the selector');
  }

  return scopeName;
}

export async function getScopeLeafTitle(page: Page, nth: number): Promise<string> {
  const locator = page.getByTestId(/^scopes-tree-.*-(checkbox|radio)/).nth(nth);
  const scopeTitle = await locator.locator('../..').textContent();

  if (!scopeTitle) {
    throw new Error('There are no scopes in the selector');
  }

  return scopeTitle;
}
