export type TestScopeType = {
  name: string;
  title: string;
};

export function openScopesSelector(testScopes: TestScopeType[]) {
  cy.intercept(
    'GET',
    '/apis/scope.grafana.app/v0alpha1/namespaces/stacks-12345/find/scope_node_children?parent=&query=',
    {
      statusCode: 200,
      body: {
        apiVersion: 'scope.grafana.app/v0alpha1',
        kind: 'FindScopeNodeChildrenResults',
        metadata: {},
        items: testScopes.map((testScope) => ({
          kind: 'ScopeNode',
          apiVersion: 'scope.grafana.app/v0alpha1',
          metadata: {
            name: `sn-${testScope.name}`,
            namespace: 'stacks-12345',
          },
          spec: {
            nodeType: 'container',
            title: testScope.title,
            description: testScope.title,
            disableMultiSelect: false,
          },
        })),
      },
    }
  ).as('scopeNodes');

  cy.get('[data-testid="scopes-selector-input"]').click();
  cy.wait('@scopeNodes');
}

export function clickScopeNode(nodeToClick: string, scopes: TestScopeType[]) {
  cy.intercept(
    'GET',
    `/apis/scope.grafana.app/v0alpha1/namespaces/stacks-12345/find/scope_node_children?parent=sn-${nodeToClick}&query=`,
    {
      statusCode: 200,
      body: {
        apiVersion: 'scope.grafana.app/v0alpha1',
        kind: 'FindScopeNodeChildrenResults',
        metadata: {},
        items: scopes.map((scope) => ({
          kind: 'ScopeNode',
          apiVersion: 'scope.grafana.app/v0alpha1',
          metadata: {
            name: `sn-${nodeToClick}-c-${scope.name}`,
            namespace: 'stacks-12345',
          },
          spec: {
            parentName: nodeToClick,
            nodeType: 'leaf',
            title: scope.title,
            description: scope.title,
            disableMultiSelect: false,
            linkType: 'scope',
            linkId: `scope-sn-${nodeToClick}-c-${scope.name}`,
          },
        })),
      },
    }
  ).as('scopeNodesLeaves');

  cy.get(`[data-testid="scopes-tree-result-sn-${nodeToClick}-expand"]`).click();
  cy.wait('@scopeNodesLeaves');
}

export function selectScope(
  parentNode: string,
  selectedScope: TestScopeType,
  filters: Array<{ key: string; value: string; operator: string }>
) {
  cy.intercept(
    'GET',
    `/apis/scope.grafana.app/v0alpha1/namespaces/stacks-12345/scopes/scope-sn-${parentNode}-c-${selectedScope.name}`,
    {
      statusCode: 200,
      body: {
        kind: 'Scope',
        apiVersion: 'scope.grafana.app/v0alpha1',
        metadata: {
          name: `scope-${parentNode}-c-${selectedScope.name}`,
          namespace: 'stacks-12345',
        },
        spec: {
          title: selectedScope.title,
          description: '',
          filters: filters,
        },
      },
    }
  ).as('scopeSelect');

  cy.get(`[data-testid="scopes-tree-result-sn-${parentNode}-c-${selectedScope.name}-checkbox"`).click({ force: true });
  cy.wait('@scopeSelect');
}

export function applyScopes(parentNode: string, scopes: TestScopeType[]) {
  const url: string =
    '/apis/scope.grafana.app/v0alpha1/namespaces/stacks-12345/find/scope_dashboard_bindings?' +
    scopes.map((scope) => `scope=scope-sn-${parentNode}-c-${scope.name}`).join('&');

  cy.intercept('GET', url, {
    statusCode: 200,
    body: {
      apiVersion: 'scope.grafana.app/v0alpha1',
      items: {
        kind: 'ScopeDashboardBinding',
        apiVersion: 'scope.grafana.app/v0alpha1',
        // TODO fix these properties
        metadata: {},
        spec: {
          dashboard: '6eea06a5efd8349dcb6317ba3f43aac4',
          scope: 'scope-sn-databases-c-dev-eu-west-1',
        },
        status: {
          dashboardTitle: 'Mimir / Compactor',
          groups: ['Mimir'],
        },
      },
    },
  }).as('scopeBindings');

  cy.get('[data-testid="scopes-selector-apply"').click({ force: true });
  cy.wait('@scopeBindings');
}
