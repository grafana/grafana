import {
  mocksNodes,
  mocksScopes,
  mocksScopeDashboardBindings,
  subScopeLokiItems,
  subScopeMimirItems,
} from './mockData';

/**
 * Mock ScopesApiClient for integration tests.
 */
export const ScopesApiClient = jest.fn().mockImplementation(() => ({
  fetchScope: jest.fn().mockImplementation((name: string) => {
    return Promise.resolve(mocksScopes.find((s) => s.metadata.name === name));
  }),
  fetchMultipleScopes: jest.fn().mockImplementation((names: string[]) => {
    return Promise.resolve(names.map((name) => mocksScopes.find((s) => s.metadata.name === name)).filter(Boolean));
  }),
  fetchMultipleScopeNodes: jest.fn().mockResolvedValue([]),
  fetchNodes: jest.fn().mockImplementation((options: { parent?: string; query?: string }) => {
    return Promise.resolve(
      mocksNodes.filter(
        (node) =>
          node.spec.parentName === (options.parent ?? '') &&
          node.spec.title.toLowerCase().includes((options.query ?? '').toLowerCase())
      )
    );
  }),
  fetchDashboards: jest.fn().mockImplementation((scopeNames: string[]) => {
    return Promise.resolve(mocksScopeDashboardBindings.filter((b) => scopeNames.includes(b.spec.scope)));
  }),
  fetchScopeNavigations: jest.fn().mockImplementation((scopeNames: string[]) => {
    if (scopeNames.includes('mimir')) {
      return Promise.resolve(subScopeMimirItems);
    }
    if (scopeNames.includes('loki')) {
      return Promise.resolve(subScopeLokiItems);
    }
    return Promise.resolve([]);
  }),
  fetchScopeNode: jest.fn().mockImplementation((name: string) => {
    return Promise.resolve(mocksNodes.find((n) => n.metadata.name === name));
  }),
}));
