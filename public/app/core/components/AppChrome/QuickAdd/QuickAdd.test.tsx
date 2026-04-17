import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { QuickAdd } from './QuickAdd';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
    getDataSourceSrv: () => ({
      getList: jest
        .fn()
        .mockReturnValue([
          { name: 'Test Data Source', uid: 'test-data-source-uid', type: 'grafana-testdata-datasource' },
        ]),
    }),
  };
});

const setup = () => {
  const navBarTree: NavModelItem[] = [
    {
      text: 'Dashboards',
      id: 'dashboards/browse',
      url: '/dashboards',
      children: [
        { text: 'New dashboard', id: 'dashboards/new', url: '/dashboard/new', isCreateAction: true },
        { text: 'Import dashboard', id: 'dashboards/import', url: '/dashboard/import', isCreateAction: true },
        { text: 'Browse', id: 'dashboards-browse', url: '/dashboards' },
      ],
    },
    {
      text: 'Alerting',
      id: 'alerting',
      url: '/alerting',
      children: [{ text: 'New alert rule', id: 'alert', url: '/alerting/new', isCreateAction: true }],
    },
    // Synthetic top-level create action — not in production navtree today, but exercises the ungrouped code path
    {
      text: 'New import',
      id: 'standalone-import',
      url: '/import',
      isCreateAction: true,
    },
  ];
  const store = configureStore({ navBarTree });
  return render(<QuickAdd />, { store });
};

describe('QuickAdd', () => {
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
    });

    it('shows a `Use template` button when the feature flag is enabled', async () => {
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      expect(screen.getByRole('menuitem', { name: 'Use template' })).toBeInTheDocument();
    });

    it('does not show a `Use template` button when the feature flag is disabled', async () => {
      config.featureToggles.dashboardTemplates = false;
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
  });
});
