import { Page, Response } from '@playwright/test';

import { testScopes } from './scopes';

const USE_LIVE_DATA = Boolean(process.env.API_CALLS_CONFIG_PATH);

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
            ...((scope.addLinks || scope.children) && {
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
            category: selectedScope.category,
            type: selectedScope.type,
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

  const groups = ['Most relevant', 'Dashboards', 'Something else', ''];

  await page.route(url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        apiVersion: 'scope.grafana.app/v0alpha1',
        items: scopes.flatMap((scope) => {
          const bindings: any = [];

          for (let i = 0; i < 10; i++) {
            const selectedGroup = groups[Math.floor(Math.random() * groups.length)];
            bindings.push({
              kind: 'ScopeDashboardBinding',
              apiVersion: 'scope.grafana.app/v0alpha1',
              metadata: {},
              spec: {
                dashboard: (scope.dashboardUid ?? 'edediimbjhdz4b') + '/' + Math.random().toString(),
                scope: `scope-${scope.name}`,
              },
              status: {
                dashboardTitle: (scope.dashboardTitle ?? 'A tall dashboard') + (selectedGroup[0] ?? 'U') + i,
                ...(selectedGroup !== '' && { groups: [selectedGroup] }),
              },
            });
          }

          // make sure there is always a binding with no group
          bindings.push({
            kind: 'ScopeDashboardBinding',
            apiVersion: 'scope.grafana.app/v0alpha1',
            metadata: {},
            spec: {
              dashboard: (scope.dashboardUid ?? 'edediimbjhdz4b') + '/' + Math.random().toString(),
              scope: `scope-${scope.name}`,
            },
            status: {
              dashboardTitle: (scope.dashboardTitle ?? 'A tall dashboard') + 'U123',
            },
          });
          return bindings;
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

export async function searchScopes(page: Page, value: string, resultScopes: TestScope[]) {
  const click = async () => await page.getByTestId('scopes-tree-search').fill(value);

  if (!resultScopes) {
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
