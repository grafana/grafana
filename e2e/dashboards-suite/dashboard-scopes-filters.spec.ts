import { e2e } from '../utils';

import { applyScopes, clickScopeNode, openScopesSelector, selectScope, TestScopeType } from './utils/scopeUtils';

const PAGE_UNDER_TEST = 'a3eb5e1028352511dfebf370e51d85cb/mimir-reads-networking';

const openDashboard = () => {
  e2e.flows.openDashboard({
    uid: 'ZqZnVvFZz',
    queryParams: {
      '__feature.scopeFilters': true,
      '__feature.passScopeToDashboardApi': true,
      '__feature.promQLScope': true,
    },
    timeRange: { from: 'now-6h', to: 'now' },
  });
};

describe('Scopes and filters dashboards', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('should set scopes', () => {
    openDashboard();
    const testScopes: TestScopeType[] = [
      {
        name: 'databases',
        title: 'Databases',
      },
    ];
    openScopesSelector(testScopes);

    clickScopeNode('databases', [
      { name: 'dev-eu-west-1', title: 'dev-eu-west-1' },
      { name: 'dev-eu-west-2', title: 'dev-eu-west-2' },
    ]);

    selectScope('databases', { name: 'dev-eu-west-1', title: 'dev-eu-west-1' }, [
      { key: 'test', operator: '=', value: 'value' },
    ]);

    selectScope('databases', { name: 'dev-eu-west-2', title: 'dev-eu-west-2' }, [
      { key: 'test', operator: '=', value: 'value' },
    ]);

    applyScopes('databases', [
      { name: 'dev-eu-west-1', title: 'dev-eu-west-1' },
      { name: 'dev-eu-west-2', title: 'dev-eu-west-2' },
    ]);
  });
});
