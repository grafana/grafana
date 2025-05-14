import { screen } from '@testing-library/react';

import { ScopesService } from '../../ScopesService';
import { ScopesSelectorService } from '../../selector/ScopesSelectorService';

const selectors = {
  tree: {
    recentScopesSection: 'scopes-selector-recent-scopes-section',
    search: 'scopes-tree-search',
    headline: 'scopes-tree-headline',
    select: (nodeId: string, type: 'result' | 'persisted') => `scopes-tree-${type}-${nodeId}-checkbox`,
    radio: (nodeId: string, type: 'result' | 'persisted') => `scopes-tree-${type}-${nodeId}-radio`,
    expand: (nodeId: string, type: 'result' | 'persisted') => `scopes-tree-${type}-${nodeId}-expand`,
    title: (nodeId: string, type: 'result' | 'persisted') => `scopes-tree-${type}-${nodeId}-title`,
  },
  selector: {
    input: 'scopes-selector-input',
    container: 'scopes-selector-container',
    loading: 'scopes-selector-loading',
    apply: 'scopes-selector-apply',
    cancel: 'scopes-selector-cancel',
    clear: 'scopes-selector-input-clear',
  },
  dashboards: {
    expand: 'scopes-dashboards-expand',
    container: 'scopes-dashboards-container',
    search: 'scopes-dashboards-search',
    loading: 'scopes-dashboards-loading',
    dashboard: (uid: string) => `scopes-dashboards-${uid}`,
    dashboardExpand: (uid: string) => `scopes-dashboards-${uid}-expand`,
    notFoundNoScopes: 'scopes-dashboards-notFoundNoScopes',
    notFoundForScope: 'scopes-dashboards-notFoundForScope',
    notFoundForFilter: 'scopes-dashboards-notFoundForFilter',
    notFoundForFilterClear: 'scopes-dashboards-notFoundForFilter-clear',
  },
};

export const getSelectorInput = () => screen.getByTestId<HTMLInputElement>(selectors.selector.input);
export const getSelectorClear = () => screen.getByTestId(selectors.selector.clear);
export const querySelectorApply = () => screen.queryByTestId(selectors.selector.apply);
export const getSelectorApply = () => screen.getByTestId(selectors.selector.apply);
export const getSelectorCancel = () => screen.getByTestId(selectors.selector.cancel);

export const getRecentScopesSection = () => screen.getByTestId(selectors.tree.recentScopesSection);
export const queryRecentScopesSection = () => screen.queryByTestId(selectors.tree.recentScopesSection);
export const getRecentScopeSet = (scope: string) => screen.getByRole('button', { name: scope });
export const queryRecentScopeSet = (scope: string) => screen.queryByRole('button', { name: scope });

export const getDashboardsExpand = () => screen.getByTestId(selectors.dashboards.expand);
export const getDashboardsContainer = () => screen.getByTestId(selectors.dashboards.container);
export const queryDashboardsContainer = () => screen.queryByTestId(selectors.dashboards.container);
export const queryDashboardsSearch = () => screen.queryByTestId(selectors.dashboards.search);
export const getDashboardsSearch = () => screen.getByTestId<HTMLInputElement>(selectors.dashboards.search);
export const queryDashboardFolderExpand = (uid: string) =>
  screen.queryByTestId(selectors.dashboards.dashboardExpand(uid));
export const getDashboardFolderExpand = (uid: string) => screen.getByTestId(selectors.dashboards.dashboardExpand(uid));
export const queryAllDashboard = (uid: string) => screen.queryAllByTestId(selectors.dashboards.dashboard(uid));
export const queryDashboard = (uid: string) => screen.queryByTestId(selectors.dashboards.dashboard(uid));
export const getDashboard = (uid: string) => screen.getByTestId(selectors.dashboards.dashboard(uid));
export const getNotFoundNoScopes = () => screen.getByTestId(selectors.dashboards.notFoundNoScopes);
export const getNotFoundForScope = () => screen.getByTestId(selectors.dashboards.notFoundForScope);
export const getNotFoundForFilter = () => screen.getByTestId(selectors.dashboards.notFoundForFilter);
export const getNotFoundForFilterClear = () => screen.getByTestId(selectors.dashboards.notFoundForFilterClear);

export const getTreeSearch = () => screen.getByTestId<HTMLInputElement>(selectors.tree.search);
export const getTreeHeadline = () => screen.getByTestId(selectors.tree.headline);
export const getResultApplicationsExpand = () => screen.getByTestId(selectors.tree.expand('applications', 'result'));
export const queryResultApplicationsGrafanaSelect = () =>
  screen.queryByTestId<HTMLInputElement>(selectors.tree.select('applications-grafana', 'result'));
export const getResultApplicationsGrafanaSelect = () =>
  screen.getByTestId<HTMLInputElement>(selectors.tree.select('applications-grafana', 'result'));
export const queryPersistedApplicationsGrafanaSelect = () =>
  screen.queryByTestId<HTMLInputElement>(selectors.tree.select('applications-grafana', 'persisted'));
export const getPersistedApplicationsGrafanaSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-grafana', 'persisted'));
export const queryResultApplicationsMimirSelect = () =>
  screen.queryByTestId(selectors.tree.select('applications-mimir', 'result'));
export const getResultApplicationsMimirSelect = () =>
  screen.getByTestId<HTMLInputElement>(selectors.tree.select('applications-mimir', 'result'));
export const queryPersistedApplicationsMimirSelect = () =>
  screen.queryByTestId(selectors.tree.select('applications-mimir', 'persisted'));
export const getPersistedApplicationsMimirSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-mimir', 'persisted'));
export const queryResultApplicationsCloudSelect = () =>
  screen.queryByTestId(selectors.tree.select('applications-cloud', 'result'));
export const getResultApplicationsCloudSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-cloud', 'result'));
export const getResultApplicationsCloudExpand = () =>
  screen.getByTestId(selectors.tree.expand('applications-cloud', 'result'));
export const getResultApplicationsCloudDevSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-cloud-dev', 'result'));

export const getResultCloudSelect = () => screen.getByTestId(selectors.tree.select('cloud', 'result'));
export const getResultCloudExpand = () => screen.getByTestId(selectors.tree.expand('cloud', 'result'));
export const getResultCloudDevRadio = () =>
  screen.getByTestId<HTMLInputElement>(selectors.tree.radio('cloud-dev', 'result'));
export const getResultCloudOpsRadio = () =>
  screen.getByTestId<HTMLInputElement>(selectors.tree.radio('cloud-ops', 'result'));

export const getListOfScopes = (service: ScopesService) => service.state.value;
export const getListOfSelectedScopes = (service: ScopesSelectorService) => service.state.selectedScopes;
export const getListOfTreeScopes = (service: ScopesSelectorService) => service.state.treeScopes;
export const getSelectedScope = (service: ScopesSelectorService, name: string) =>
  getListOfSelectedScopes(service)?.find((selectedScope) => selectedScope.scope.metadata.name === name);
export const getTreeScope = (service: ScopesSelectorService, name: string) =>
  getListOfTreeScopes(service)?.find((treeScope) => treeScope.scopeName === name);
