import { Page, Response } from '@playwright/test';

export type TestScope = {
  name: string;
  title: string;
  filters: Array<{ key: string; value: string; operator: string }>;
  dashboardUid?: string;
  dashboardTitle?: string;
};

export async function openScopesSelector(page: Page, testScopes: TestScope[]) {
  await page.route(`**/apis/scope.grafana.app/v0alpha1/namespaces/*/find/scope_node_children*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        apiVersion: 'scope.grafana.app/v0alpha1',
        kind: 'FindScopeNodeChildrenResults',
        metadata: {},
        items: testScopes.map((scope) => ({
          kind: 'ScopeNode',
          apiVersion: 'scope.grafana.app/v0alpha1',
          metadata: {
            name: `sn-databases-l-${scope.name}`,
            namespace: 'default',
          },
          spec: {
            parentName: 'databases',
            nodeType: 'leaf',
            title: scope.title,
            description: scope.title,
            disableMultiSelect: false,
            linkType: 'scope',
            linkId: `scope-sn-databases-l-${scope.name}`,
          },
        })),
      }),
    });
  });

  const responsePromise = page.waitForResponse((response) => response.url().includes('/find/scope_node_children'));

  await page.getByTestId('scopes-selector-input').click();
  await responsePromise;
}

async function scopeSel(page: Page, selectedScope: TestScope): Promise<Response> {
  await page.route(
    `**/apis/scope.grafana.app/v0alpha1/namespaces/*/scopes/scope-sn-databases-l-${selectedScope.name}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'Scope',
          apiVersion: 'scope.grafana.app/v0alpha1',
          metadata: {
            name: `scope-sn-databases-l-${selectedScope.name}`,
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

  return page.waitForResponse((response) =>
    response.url().includes(`/scopes/scope-sn-databases-l-${selectedScope.name}`)
  );
}

export async function selectScope(page: Page, selectedScope: TestScope) {
  await page.waitForTimeout(500);
  const responsePromise = scopeSel(page, selectedScope);

  await page.getByTestId(`scopes-tree-sn-databases-l-${selectedScope.name}-checkbox`).click({ force: true });
  await responsePromise;
}

export async function applyScopes(page: Page, scopes: TestScope[]) {
  const url: string =
    '**/apis/scope.grafana.app/v0alpha1/namespaces/*/find/scope_dashboard_bindings?' +
    scopes.map((scope) => `scope=scope-sn-databases-l-${scope.name}`).join('&');

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
              scope: `scope-sn-databases-l-${scope.name}`,
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
    x.push(scopeSel(page, scope));
  }

  await page.getByTestId('scopes-selector-apply').click({ force: true });
  await responsePromise;
  await Promise.all(x);
}
