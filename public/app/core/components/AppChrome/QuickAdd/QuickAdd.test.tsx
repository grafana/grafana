import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { type DataSourceInstanceSettings, type NavModelItem } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { useDataSourceInstanceSettingsList } from '@grafana/runtime/internal';
import { NewDashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/analytics/main';
import { CONTENT_KINDS, SOURCE_ENTRY_POINTS } from 'app/features/dashboard/dashgrid/DashboardLibrary/constants';
import { DashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/interactions';
import { configureStore } from 'app/store/configureStore';

import { QuickAdd } from './QuickAdd';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
  };
});

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useDataSourceInstanceSettingsList: jest.fn(),
}));

jest.mock('@openfeature/react-sdk', () => ({
  ...jest.requireActual('@openfeature/react-sdk'),
  useBooleanFlagValue: jest.fn(),
}));

jest.mock('app/features/dashboard/dashgrid/DashboardLibrary/analytics/main', () => ({
  NewDashboardLibraryInteractions: { entryPointClicked: jest.fn() },
}));

jest.mock('app/features/dashboard/dashgrid/DashboardLibrary/interactions', () => ({
  DashboardLibraryInteractions: { entryPointClicked: jest.fn() },
}));

const useBooleanFlagValueMock = jest.mocked(useBooleanFlagValue);
const useDataSourceInstanceSettingsListMock = jest.mocked(useDataSourceInstanceSettingsList);

const testDataSource = {
  name: 'Test Data Source',
  uid: 'test-data-source-uid',
  type: 'grafana-testdata-datasource',
} as DataSourceInstanceSettings;

const dashboardsNavItem: NavModelItem = {
  text: 'Dashboards',
  id: 'dashboards/browse',
  url: '/dashboards',
  children: [
    { text: 'New dashboard', id: 'dashboards/new', url: '/dashboard/new', isCreateAction: true },
    { text: 'Import dashboard', id: 'dashboards/import', url: '/dashboard/import', isCreateAction: true },
    { text: 'Browse', id: 'dashboards-browse', url: '/dashboards' },
  ],
};

const alertingNavItem: NavModelItem = {
  text: 'Alerting',
  id: 'alerting',
  url: '/alerting',
  children: [{ text: 'New alert rule', id: 'alert', url: '/alerting/new', isCreateAction: true }],
};

const setTestDataSources = (items: DataSourceInstanceSettings[]) => {
  useDataSourceInstanceSettingsListMock.mockReturnValue({ items, isLoading: false });
};

const setup = (navBarTree?: NavModelItem[]) => {
  const tree: NavModelItem[] = navBarTree ?? [
    dashboardsNavItem,
    alertingNavItem,
    // Synthetic top-level create action — not in production navtree today, but exercises the ungrouped code path
    {
      text: 'New import',
      id: 'standalone-import',
      url: '/import',
      isCreateAction: true,
    },
  ];
  const store = configureStore({ navBarTree: tree });
  return render(<QuickAdd />, { store });
};

describe('QuickAdd', () => {
  const originalDashboardTemplates = config.featureToggles.dashboardTemplates;

  beforeAll(() => {
    jest.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          matches: true,
        }) as unknown as MediaQueryList
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // analyticsFramework defaults to enabled in production
    useBooleanFlagValueMock.mockReturnValue(true);
    config.featureToggles.dashboardTemplates = false;
    setTestDataSources([]);
  });

  afterEach(() => {
    config.featureToggles.dashboardTemplates = originalDashboardTemplates;
  });

  it('renders a `New` button', () => {
    setup();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });

  it('shows isCreateAction options when clicked', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(screen.getByRole('menuitem', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Import dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New alert rule' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New import' })).toBeInTheDocument();
  });

  it('reports interaction when a menu item is clicked', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'New dashboard' }));

    expect(reportInteraction).toHaveBeenCalledWith('grafana_menu_item_clicked', {
      url: '/dashboard/new',
      from: 'quickadd',
    });
    errorSpy.mockRestore();
  });

  it('renders items under their correct group', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));

    const dashboardGroup = screen.getByRole('group', { name: 'Dashboards' });
    expect(within(dashboardGroup).getByRole('menuitem', { name: 'New dashboard' })).toBeInTheDocument();
    expect(within(dashboardGroup).getByRole('menuitem', { name: 'Import dashboard' })).toBeInTheDocument();

    const alertingGroup = screen.getByRole('group', { name: 'Alerting' });
    expect(within(alertingGroup).getByRole('menuitem', { name: 'New alert rule' })).toBeInTheDocument();
  });

  it('renders ungrouped items without a group header', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));

    const importItem = screen.getByRole('menuitem', { name: 'New import' });
    expect(importItem).toBeInTheDocument();

    const allGroups = screen.getAllByRole('group');
    const ungroupedGroup = allGroups.find(
      (group) => !group.hasAttribute('aria-labelledby') && !group.hasAttribute('aria-label')
    );
    expect(ungroupedGroup).toBeDefined();
    expect(within(ungroupedGroup!).getByRole('menuitem', { name: 'New import' })).toBeInTheDocument();
  });

  describe('Use template button', () => {
    beforeEach(() => {
      config.featureToggles.dashboardTemplates = true;
      setTestDataSources([testDataSource]);
    });

    it('shows a `Use template` button when the feature flag is enabled and a test data source exists', async () => {
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      expect(screen.getByRole('menuitem', { name: 'Use template' })).toBeInTheDocument();
    });

    it('does not show a `Use template` button when there is no dashboard group', async () => {
      setup([alertingNavItem]);
      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      expect(screen.queryByRole('menuitem', { name: 'Use template' })).not.toBeInTheDocument();
    });

    it('does not show a `Use template` button when the feature flag is disabled', async () => {
      config.featureToggles.dashboardTemplates = false;
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      expect(screen.queryByRole('menuitem', { name: 'Use template' })).not.toBeInTheDocument();
    });

    it('does not show a `Use template` button when there are no test data sources', async () => {
      setTestDataSources([]);
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      expect(screen.queryByRole('menuitem', { name: 'Use template' })).not.toBeInTheDocument();
    });

    it('redirects the user to the dashboard from template page when the button is clicked', async () => {
      setup();

      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      const link = screen.getByRole('menuitem', { name: 'Use template' });
      expect(link).toHaveAttribute('href', '/dashboards?templateDashboards=true&source=quickAdd');
    });

    it('reports the new analytics framework interaction when clicked and the framework is enabled', async () => {
      // Clicking the menu item navigates via its href, which jsdom logs as unimplemented
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      useBooleanFlagValueMock.mockReturnValue(true);
      setup();

      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Use template' }));

      expect(NewDashboardLibraryInteractions.entryPointClicked).toHaveBeenCalledWith({
        entryPoint: SOURCE_ENTRY_POINTS.QUICK_ADD_BUTTON,
        contentKind: CONTENT_KINDS.TEMPLATE_DASHBOARD,
      });
      expect(DashboardLibraryInteractions.entryPointClicked).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('reports the legacy interaction when clicked and the analytics framework is disabled', async () => {
      // Clicking the menu item navigates via its href, which jsdom logs as unimplemented
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      useBooleanFlagValueMock.mockReturnValue(false);
      setup();

      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Use template' }));

      expect(DashboardLibraryInteractions.entryPointClicked).toHaveBeenCalledWith({
        entryPoint: SOURCE_ENTRY_POINTS.QUICK_ADD_BUTTON,
        contentKind: CONTENT_KINDS.TEMPLATE_DASHBOARD,
      });
      expect(NewDashboardLibraryInteractions.entryPointClicked).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
