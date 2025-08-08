import { waitFor } from '@testing-library/dom';

import { config, locationService } from '@grafana/runtime';

import { ScopesService } from '../ScopesService';
import { ScopesDashboardsService } from '../dashboards/ScopesDashboardsService';

import {
  clearNotFound,
  expandDashboardFolder,
  searchDashboards,
  toggleDashboards,
  updateScopes,
} from './utils/actions';
import {
  expectDashboardFolderNotInDocument,
  expectDashboardInDocument,
  expectDashboardLength,
  expectDashboardNotInDocument,
  expectDashboardsClosed,
  expectDashboardSearchValue,
  expectDashboardsOpen,
  expectDashboardsSearch,
  expectNoDashboardsForFilter,
  expectNoDashboardsForScope,
  expectNoDashboardsNoScopes,
  expectNoDashboardsSearch,
} from './utils/assertions';
import {
  alternativeDashboardWithRootFolder,
  alternativeDashboardWithTwoFolders,
  dashboardWithOneFolder,
  dashboardWithoutFolder,
  dashboardWithRootFolder,
  dashboardWithRootFolderAndOtherFolder,
  dashboardWithTwoFolders,
  getDatasource,
  getInstanceSettings,
  getMock,
} from './utils/mocks';
import { renderDashboard, resetScenes } from './utils/render';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getBackendSrv: () => ({ get: getMock }),
  getDataSourceSrv: () => ({ get: getDatasource, getInstanceSettings }),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

describe('Dashboards list', () => {
  let fetchDashboardsSpy: jest.SpyInstance;
  let scopesService: ScopesService;
  let scopesDashboardsService: ScopesDashboardsService;

  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  beforeEach(async () => {
    const result = await renderDashboard();
    scopesService = result.scopesService;
    scopesDashboardsService = result.scopesDashboardsService;
    fetchDashboardsSpy = jest.spyOn(result.client, 'fetchDashboards');
  });

  afterEach(async () => {
    locationService.replace('');
    await resetScenes([fetchDashboardsSpy]);
  });

  it('Opens container and fetches dashboards list when a scope is selected', async () => {
    expectDashboardsClosed();
    await updateScopes(scopesService, ['mimir']);
    expectDashboardsOpen();
    expect(fetchDashboardsSpy).toHaveBeenCalled();
  });

  it('Closes container when no scopes are selected', async () => {
    await updateScopes(scopesService, ['mimir']);
    expectDashboardsOpen();
    await updateScopes(scopesService, ['mimir', 'loki']);
    expectDashboardsOpen();
    await updateScopes(scopesService, []);
    expectDashboardsClosed();
  });

  it('Fetches dashboards list when the list is expanded', async () => {
    await toggleDashboards();
    await updateScopes(scopesService, ['mimir']);
    expect(fetchDashboardsSpy).toHaveBeenCalled();
  });

  it('Fetches dashboards list when the list is expanded after scope selection', async () => {
    await updateScopes(scopesService, ['mimir']);
    await toggleDashboards();
    expect(fetchDashboardsSpy).toHaveBeenCalled();
  });

  it('Shows dashboards for multiple scopes', async () => {
    await toggleDashboards();
    await updateScopes(scopesService, ['grafana']);
    await expandDashboardFolder('General');
    await expandDashboardFolder('Observability');
    await expandDashboardFolder('Usage');
    expectDashboardFolderNotInDocument('Components');
    expectDashboardFolderNotInDocument('Investigations');
    expectDashboardInDocument('general-data-sources');
    expectDashboardInDocument('general-usage');
    expectDashboardInDocument('observability-backend-errors');
    expectDashboardInDocument('observability-backend-logs');
    expectDashboardInDocument('observability-frontend-errors');
    expectDashboardInDocument('observability-frontend-logs');
    expectDashboardInDocument('usage-data-sources');
    expectDashboardInDocument('usage-stats');
    expectDashboardInDocument('usage-usage-overview');
    expectDashboardInDocument('frontend');
    expectDashboardInDocument('overview');
    expectDashboardInDocument('stats');
    expectDashboardNotInDocument('multiple3-datasource-errors');
    expectDashboardNotInDocument('multiple4-datasource-logs');
    expectDashboardNotInDocument('multiple0-ingester');
    expectDashboardNotInDocument('multiple1-distributor');
    expectDashboardNotInDocument('multiple2-compacter');
    expectDashboardNotInDocument('another-stats');

    await updateScopes(scopesService, ['grafana', 'mimir']);
    await expandDashboardFolder('General');
    await expandDashboardFolder('Observability');
    await expandDashboardFolder('Usage');
    await expandDashboardFolder('Components');
    await expandDashboardFolder('Investigations');
    expectDashboardInDocument('general-data-sources');
    expectDashboardInDocument('general-usage');
    expectDashboardInDocument('observability-backend-errors');
    expectDashboardInDocument('observability-backend-logs');
    expectDashboardInDocument('observability-frontend-errors');
    expectDashboardInDocument('observability-frontend-logs');
    expectDashboardInDocument('usage-data-sources');
    expectDashboardInDocument('usage-stats');
    expectDashboardInDocument('usage-usage-overview');
    expectDashboardInDocument('frontend');
    expectDashboardInDocument('overview');
    expectDashboardInDocument('stats');
    expectDashboardLength('multiple3-datasource-errors', 2);
    expectDashboardLength('multiple4-datasource-logs', 2);
    expectDashboardLength('multiple0-ingester', 2);
    expectDashboardLength('multiple1-distributor', 2);
    expectDashboardLength('multiple2-compacter', 2);
    expectDashboardInDocument('another-stats');

    await updateScopes(scopesService, ['grafana']);
    await expandDashboardFolder('General');
    await expandDashboardFolder('Observability');
    await expandDashboardFolder('Usage');
    expectDashboardFolderNotInDocument('Components');
    expectDashboardFolderNotInDocument('Investigations');
    expectDashboardInDocument('general-data-sources');
    expectDashboardInDocument('general-usage');
    expectDashboardInDocument('observability-backend-errors');
    expectDashboardInDocument('observability-backend-logs');
    expectDashboardInDocument('observability-frontend-errors');
    expectDashboardInDocument('observability-frontend-logs');
    expectDashboardInDocument('usage-data-sources');
    expectDashboardInDocument('usage-stats');
    expectDashboardInDocument('usage-usage-overview');
    expectDashboardInDocument('frontend');
    expectDashboardInDocument('overview');
    expectDashboardInDocument('stats');
    expectDashboardFolderNotInDocument('multiple3-datasource-errors');
    expectDashboardFolderNotInDocument('multiple4-datasource-logs');
    expectDashboardFolderNotInDocument('multiple0-ingester');
    expectDashboardFolderNotInDocument('multiple1-distributor');
    expectDashboardFolderNotInDocument('multiple2-compacter');
    expectDashboardFolderNotInDocument('another-stats');
  });

  it('Filters the dashboards list for dashboards', async () => {
    await toggleDashboards();
    await updateScopes(scopesService, ['grafana']);
    await expandDashboardFolder('General');
    await expandDashboardFolder('Observability');
    await expandDashboardFolder('Usage');
    expectDashboardInDocument('general-data-sources');
    expectDashboardInDocument('general-usage');
    expectDashboardInDocument('observability-backend-errors');
    expectDashboardInDocument('observability-backend-logs');
    expectDashboardInDocument('observability-frontend-errors');
    expectDashboardInDocument('observability-frontend-logs');
    expectDashboardInDocument('usage-data-sources');
    expectDashboardInDocument('usage-stats');
    expectDashboardInDocument('usage-usage-overview');
    expectDashboardInDocument('frontend');
    expectDashboardInDocument('overview');
    expectDashboardInDocument('stats');

    await searchDashboards('Stats');
    expectDashboardFolderNotInDocument('general-data-sources');
    expectDashboardFolderNotInDocument('general-usage');
    expectDashboardFolderNotInDocument('observability-backend-errors');
    expectDashboardFolderNotInDocument('observability-backend-logs');
    expectDashboardFolderNotInDocument('observability-frontend-errors');
    expectDashboardFolderNotInDocument('observability-frontend-logs');
    expectDashboardFolderNotInDocument('usage-data-sources');
    expectDashboardInDocument('usage-stats');
    expectDashboardFolderNotInDocument('usage-usage-overview');
    expectDashboardFolderNotInDocument('frontend');
    expectDashboardFolderNotInDocument('overview');
    expectDashboardInDocument('stats');
  });

  it('Filters the dashboards list for folders', async () => {
    await toggleDashboards();
    await updateScopes(scopesService, ['grafana']);
    await expandDashboardFolder('General');
    await expandDashboardFolder('Observability');
    await expandDashboardFolder('Usage');
    expectDashboardInDocument('general-data-sources');
    expectDashboardInDocument('general-usage');
    expectDashboardInDocument('observability-backend-errors');
    expectDashboardInDocument('observability-backend-logs');
    expectDashboardInDocument('observability-frontend-errors');
    expectDashboardInDocument('observability-frontend-logs');
    expectDashboardInDocument('usage-data-sources');
    expectDashboardInDocument('usage-stats');
    expectDashboardInDocument('usage-usage-overview');
    expectDashboardInDocument('frontend');
    expectDashboardInDocument('overview');
    expectDashboardInDocument('stats');

    await searchDashboards('Usage');
    expectDashboardFolderNotInDocument('general-data-sources');
    expectDashboardInDocument('general-usage');
    expectDashboardFolderNotInDocument('observability-backend-errors');
    expectDashboardFolderNotInDocument('observability-backend-logs');
    expectDashboardFolderNotInDocument('observability-frontend-errors');
    expectDashboardFolderNotInDocument('observability-frontend-logs');
    expectDashboardInDocument('usage-data-sources');
    expectDashboardInDocument('usage-stats');
    expectDashboardInDocument('usage-usage-overview');
    expectDashboardFolderNotInDocument('frontend');
    expectDashboardFolderNotInDocument('overview');
    expectDashboardFolderNotInDocument('stats');
  });

  it('Deduplicates the dashboards list', async () => {
    await toggleDashboards();
    await updateScopes(scopesService, ['dev', 'ops']);
    await expandDashboardFolder('Cardinality Management');
    await expandDashboardFolder('Usage Insights');
    expectDashboardLength('cardinality-management-labels', 1);
    expectDashboardLength('cardinality-management-metrics', 1);
    expectDashboardLength('cardinality-management-overview', 1);
    expectDashboardLength('usage-insights-alertmanager', 1);
    expectDashboardLength('usage-insights-data-sources', 1);
    expectDashboardLength('usage-insights-metrics-ingestion', 1);
    expectDashboardLength('usage-insights-overview', 1);
    expectDashboardLength('usage-insights-query-errors', 1);
    expectDashboardLength('billing-usage', 1);
  });

  it('Shows a proper message when no scopes are selected', async () => {
    await toggleDashboards();
    expectNoDashboardsNoScopes();
    expectNoDashboardsSearch();
  });

  it('Does not show the input when there are no dashboards found for scope', async () => {
    await updateScopes(scopesService, ['cloud']);
    await toggleDashboards();
    expectNoDashboardsForScope();
    expectNoDashboardsSearch();
  });

  it('Shows the input and a message when there are no dashboards found for filter', async () => {
    await updateScopes(scopesService, ['mimir']);
    await searchDashboards('unknown');
    expectDashboardsSearch();
    await waitFor(() => expectNoDashboardsForFilter());

    await clearNotFound();
    expectDashboardSearchValue('');
  });

  describe('groupDashboards', () => {
    it('Assigns dashboards without groups to root folder', () => {
      expect(scopesDashboardsService.groupSuggestedItems([dashboardWithoutFolder])).toEqual({
        '': {
          title: '',
          expanded: true,
          folders: {},
          suggestedNavigations: {
            [dashboardWithoutFolder.spec.dashboard]: {
              url: '/d/' + dashboardWithoutFolder.spec.dashboard,
              title: dashboardWithoutFolder.status.dashboardTitle,
              id: dashboardWithoutFolder.spec.dashboard,
            },
          },
        },
      });
    });

    it('Assigns dashboards with root group to root folder', () => {
      expect(scopesDashboardsService.groupSuggestedItems([dashboardWithRootFolder])).toEqual({
        '': {
          title: '',
          expanded: true,
          folders: {},
          suggestedNavigations: {
            [dashboardWithRootFolder.spec.dashboard]: {
              url: '/d/' + dashboardWithRootFolder.spec.dashboard,
              title: dashboardWithRootFolder.status.dashboardTitle,
              id: dashboardWithRootFolder.spec.dashboard,
            },
          },
        },
      });
    });

    it('Merges folders from multiple dashboards', () => {
      expect(scopesDashboardsService.groupSuggestedItems([dashboardWithOneFolder, dashboardWithTwoFolders])).toEqual({
        '': {
          title: '',
          expanded: true,
          folders: {
            'Folder 1': {
              title: 'Folder 1',
              expanded: false,
              folders: {},
              suggestedNavigations: {
                [dashboardWithOneFolder.spec.dashboard]: {
                  url: '/d/' + dashboardWithOneFolder.spec.dashboard,
                  title: dashboardWithOneFolder.status.dashboardTitle,
                  id: dashboardWithOneFolder.spec.dashboard,
                },
                [dashboardWithTwoFolders.spec.dashboard]: {
                  url: '/d/' + dashboardWithTwoFolders.spec.dashboard,
                  title: dashboardWithTwoFolders.status.dashboardTitle,
                  id: dashboardWithTwoFolders.spec.dashboard,
                },
              },
            },
            'Folder 2': {
              title: 'Folder 2',
              expanded: false,
              folders: {},
              suggestedNavigations: {
                [dashboardWithTwoFolders.spec.dashboard]: {
                  url: '/d/' + dashboardWithTwoFolders.spec.dashboard,
                  title: dashboardWithTwoFolders.status.dashboardTitle,
                  id: dashboardWithTwoFolders.spec.dashboard,
                },
              },
            },
          },
          suggestedNavigations: {},
        },
      });
    });

    it('Merges scopes from multiple dashboards', () => {
      expect(
        scopesDashboardsService.groupSuggestedItems([dashboardWithTwoFolders, alternativeDashboardWithTwoFolders])
      ).toEqual({
        '': {
          title: '',
          expanded: true,
          folders: {
            'Folder 1': {
              title: 'Folder 1',
              expanded: false,
              folders: {},
              suggestedNavigations: {
                [dashboardWithTwoFolders.spec.dashboard]: {
                  url: '/d/' + dashboardWithTwoFolders.spec.dashboard,
                  title: dashboardWithTwoFolders.status.dashboardTitle,
                  id: dashboardWithTwoFolders.spec.dashboard,
                },
              },
            },
            'Folder 2': {
              title: 'Folder 2',
              expanded: false,
              folders: {},
              suggestedNavigations: {
                [dashboardWithTwoFolders.spec.dashboard]: {
                  url: '/d/' + dashboardWithTwoFolders.spec.dashboard,
                  title: dashboardWithTwoFolders.status.dashboardTitle,
                  id: dashboardWithTwoFolders.spec.dashboard,
                },
              },
            },
          },
          suggestedNavigations: {},
        },
      });
    });

    it('Matches snapshot', () => {
      expect(
        scopesDashboardsService.groupSuggestedItems([
          dashboardWithoutFolder,
          dashboardWithOneFolder,
          dashboardWithTwoFolders,
          alternativeDashboardWithTwoFolders,
          dashboardWithRootFolder,
          alternativeDashboardWithRootFolder,
          dashboardWithRootFolderAndOtherFolder,
        ])
      ).toEqual({
        '': {
          suggestedNavigations: {
            [dashboardWithRootFolderAndOtherFolder.spec.dashboard]: {
              url: '/d/' + dashboardWithRootFolderAndOtherFolder.spec.dashboard,
              title: dashboardWithRootFolderAndOtherFolder.status.dashboardTitle,
              id: dashboardWithRootFolderAndOtherFolder.spec.dashboard,
            },
            [dashboardWithRootFolder.spec.dashboard]: {
              url: '/d/' + dashboardWithRootFolder.spec.dashboard,
              title: dashboardWithRootFolder.status.dashboardTitle,
              id: dashboardWithRootFolder.spec.dashboard,
            },
            [dashboardWithoutFolder.spec.dashboard]: {
              url: '/d/' + dashboardWithoutFolder.spec.dashboard,
              title: dashboardWithoutFolder.status.dashboardTitle,
              id: dashboardWithoutFolder.spec.dashboard,
            },
          },
          folders: {
            'Folder 1': {
              suggestedNavigations: {
                [dashboardWithOneFolder.spec.dashboard]: {
                  url: '/d/' + dashboardWithOneFolder.spec.dashboard,
                  title: dashboardWithOneFolder.status.dashboardTitle,
                  id: dashboardWithOneFolder.spec.dashboard,
                },
                [dashboardWithTwoFolders.spec.dashboard]: {
                  url: '/d/' + dashboardWithTwoFolders.spec.dashboard,
                  title: dashboardWithTwoFolders.status.dashboardTitle,
                  id: dashboardWithTwoFolders.spec.dashboard,
                },
              },
              folders: {},
              expanded: false,
              title: 'Folder 1',
            },
            'Folder 2': {
              suggestedNavigations: {
                [dashboardWithTwoFolders.spec.dashboard]: {
                  url: '/d/' + dashboardWithTwoFolders.spec.dashboard,
                  title: dashboardWithTwoFolders.status.dashboardTitle,
                  id: dashboardWithTwoFolders.spec.dashboard,
                },
              },
              folders: {},
              expanded: false,
              title: 'Folder 2',
            },
            'Folder 3': {
              suggestedNavigations: {
                [dashboardWithRootFolderAndOtherFolder.spec.dashboard]: {
                  url: '/d/' + dashboardWithRootFolderAndOtherFolder.spec.dashboard,
                  title: dashboardWithRootFolderAndOtherFolder.status.dashboardTitle,
                  id: dashboardWithRootFolderAndOtherFolder.spec.dashboard,
                },
              },
              folders: {},
              expanded: false,
              title: 'Folder 3',
            },
          },
          expanded: true,
          title: '',
        },
      });
    });
  });

  describe('filterFolders', () => {
    it('Shows folders matching criteria', () => {
      expect(
        scopesDashboardsService.filterFolders(
          {
            '': {
              title: '',
              expanded: true,
              folders: {
                'Folder 1': {
                  title: 'Folder 1',
                  expanded: false,
                  folders: {},
                  suggestedNavigations: {
                    'Dashboard ID': {
                      url: '/d/Dashboard ID',
                      title: 'Dashboard Title',
                      id: 'Dashboard ID',
                    },
                  },
                },
                'Folder 2': {
                  title: 'Folder 2',
                  expanded: true,
                  folders: {},
                  suggestedNavigations: {
                    'Dashboard ID': {
                      url: '/d/Dashboard ID',
                      title: 'Dashboard Title',
                      id: 'Dashboard ID',
                    },
                  },
                },
              },
              suggestedNavigations: {
                'Dashboard ID': {
                  url: '/d/Dashboard ID',
                  title: 'Dashboard Title',
                  id: 'Dashboard ID',
                },
              },
            },
          },
          'Folder'
        )
      ).toEqual({
        '': {
          title: '',
          expanded: true,
          folders: {
            'Folder 1': {
              title: 'Folder 1',
              expanded: true,
              folders: {},
              suggestedNavigations: {
                'Dashboard ID': {
                  url: '/d/Dashboard ID',
                  title: 'Dashboard Title',
                  id: 'Dashboard ID',
                },
              },
            },
            'Folder 2': {
              title: 'Folder 2',
              expanded: true,
              folders: {},
              suggestedNavigations: {
                'Dashboard ID': {
                  url: '/d/Dashboard ID',
                  title: 'Dashboard Title',
                  id: 'Dashboard ID',
                },
              },
            },
          },
          suggestedNavigations: {},
        },
      });
    });

    it('Shows dashboards matching criteria', () => {
      expect(
        scopesDashboardsService.filterFolders(
          {
            '': {
              title: '',
              expanded: true,
              folders: {
                'Folder 1': {
                  title: 'Folder 1',
                  expanded: false,
                  folders: {},
                  suggestedNavigations: {
                    'Dashboard ID': {
                      url: '/d/Dashboard ID',
                      title: 'Dashboard Title',
                      id: 'Dashboard ID',
                    },
                  },
                },
                'Folder 2': {
                  title: 'Folder 2',
                  expanded: true,
                  folders: {},
                  suggestedNavigations: {
                    'Random ID': {
                      url: '/d/Random ID',
                      title: 'Random Title',
                      id: 'Random ID',
                    },
                  },
                },
              },
              suggestedNavigations: {
                'Dashboard ID': {
                  url: '/d/Dashboard ID',
                  title: 'Dashboard Title',
                  id: 'Dashboard ID',
                },
                'Random ID': {
                  url: '/d/Random ID',
                  title: 'Random Title',
                  id: 'Random ID',
                },
              },
            },
          },
          'dash'
        )
      ).toEqual({
        '': {
          title: '',
          expanded: true,
          folders: {
            'Folder 1': {
              title: 'Folder 1',
              expanded: true,
              folders: {},
              suggestedNavigations: {
                'Dashboard ID': {
                  url: '/d/Dashboard ID',
                  title: 'Dashboard Title',
                  id: 'Dashboard ID',
                },
              },
            },
          },
          suggestedNavigations: {
            'Dashboard ID': {
              url: '/d/Dashboard ID',
              title: 'Dashboard Title',
              id: 'Dashboard ID',
            },
          },
        },
      });
    });
  });
});
