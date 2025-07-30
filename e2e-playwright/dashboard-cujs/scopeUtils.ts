import { Page, Response } from '@playwright/test';

export type TestScopeType = {
  name: string;
  title: string;
};

export async function openScopesSelector(page: Page, testScopes: TestScopeType[]) {
  // Set up route interception
  await page.route('**/apis/scope.grafana.app/v0alpha1/namespaces/*/find/scope_node_children*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        apiVersion: 'scope.grafana.app/v0alpha1',
        kind: 'FindScopeNodeChildrenResults',
        metadata: {},
        items: testScopes.map((testScope) => ({
          kind: 'ScopeNode',
          apiVersion: 'scope.grafana.app/v0alpha1',
          metadata: {
            name: `sn-${testScope.name}`,
            namespace: 'default',
          },
          spec: {
            nodeType: 'container',
            title: testScope.title,
            description: testScope.title,
            disableMultiSelect: false,
          },
        })),
      }),
    });
  });

  // Click the selector and wait for the network request
  const responsePromise = page.waitForResponse((response) => response.url().includes('/find/scope_node_children'));

  await page.getByTestId('scopes-selector-input').click();
  await responsePromise;
}

export async function clickScopeNode(page: Page, nodeToClick: string, scopes: TestScopeType[]) {
  // Set up route interception
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
            name: `sn-${nodeToClick}-l-${scope.name}`,
            namespace: 'default',
          },
          spec: {
            parentName: nodeToClick,
            nodeType: 'leaf',
            title: scope.title,
            description: scope.title,
            disableMultiSelect: false,
            linkType: 'scope',
            linkId: `scope-sn-${nodeToClick}-l-${scope.name}`,
          },
        })),
      }),
    });
  });

  const responsePromise = page.waitForResponse((response) => response.url().includes('/find/scope_node_children'));

  await page.getByTestId(`scopes-tree-sn-${nodeToClick}-expand`).click();
  await responsePromise;
}

async function scopeSel(
  page: Page,
  parentNode: string,
  selectedScope: TestScopeType,
  filters: Array<{ key: string; value: string; operator: string }>
): Promise<Response> {
  await page.route(
    `**/apis/scope.grafana.app/v0alpha1/namespaces/*/scopes/scope-sn-${parentNode}-l-${selectedScope.name}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'Scope',
          apiVersion: 'scope.grafana.app/v0alpha1',
          metadata: {
            name: `scope-sn-${parentNode}-l-${selectedScope.name}`,
            namespace: 'default',
          },
          spec: {
            title: selectedScope.title,
            description: '',
            filters: filters,
          },
        }),
      });
    }
  );

  return page.waitForResponse((response) =>
    response.url().includes(`/scopes/scope-sn-${parentNode}-l-${selectedScope.name}`)
  );
}

export async function selectScope(
  page: Page,
  parentNode: string,
  selectedScope: TestScopeType,
  filters: Array<{ key: string; value: string; operator: string }>
) {
  const responsePromise = scopeSel(page, parentNode, selectedScope, filters);

  await page.getByTestId(`scopes-tree-sn-${parentNode}-l-${selectedScope.name}-checkbox`).click({ force: true });
  await responsePromise;
}

export async function applyScopes(page: Page, parentNode: string, scopes: TestScopeType[]) {
  const url: string =
    '**/apis/scope.grafana.app/v0alpha1/namespaces/*/find/scope_dashboard_bindings?' +
    scopes.map((scope) => `scope=scope-sn-${parentNode}-l-${scope.name}`).join('&');

  // Set up route interception
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
              dashboard: '06b1705e8960c1ad77caf7f3eba3caba',
              scope: `scope-sn-${parentNode}-l-${scope.name}`,
            },
            status: {
              dashboardTitle: 'Mimir / rollout-operator',
              groups: ['Mimir'],
            },
          };
        }),
      }),
    });
  });

  const responsePromise = page.waitForResponse((response) => response.url().includes(`/find/scope_dashboard_bindings`));
  const x: Array<Promise<Response>> = [];

  for (const scope of scopes) {
    x.push(scopeSel(page, parentNode, scope, [{ key: 'namespace', value: scope.name, operator: 'equals' }]));
  }

  await page.getByTestId('scopes-selector-apply').click({ force: true });
  await responsePromise;
  await Promise.all(x);
}
