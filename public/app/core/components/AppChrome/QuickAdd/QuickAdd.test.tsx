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

function setup(navBarTreeOverride?: NavModelItem[]) {
  const navBarTree: NavModelItem[] = navBarTreeOverride ?? [
    {
      text: 'Dashboards',
      id: 'dashboards/browse',
      url: '/dashboards',
      children: [
        { text: 'New dashboard', id: 'dashboards/new', url: '/dashboard/new', isCreateAction: true },
        { text: 'Import dashboard', id: 'dashboards/import', url: '/dashboard/import', isCreateAction: true },
      ],
    },
    {
      text: 'Alerting',
      id: 'alerting',
      url: '/alerting',
      children: [{ text: 'Create alert rule', id: 'alert', url: '/alerting/new', isCreateAction: true }],
    },
  ];
  const store = configureStore({ navBarTree });
  return render(<QuickAdd />, { store });
}

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

  it('renders grouped menu items with labels from the nav tree', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));

    const dashboardGroup = screen.getByRole('group', { name: 'Dashboards' });
    expect(within(dashboardGroup).getByRole('menuitem', { name: 'New dashboard' })).toBeInTheDocument();
    expect(within(dashboardGroup).getByRole('menuitem', { name: 'Import dashboard' })).toBeInTheDocument();

    const alertGroup = screen.getByRole('group', { name: 'Alerting' });
    expect(within(alertGroup).getByRole('menuitem', { name: 'Create alert rule' })).toBeInTheDocument();
  });

  it('renders both groups inside the menu', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('group')).toHaveLength(2);
  });

  it('reports interaction when a menu item is clicked', async () => {
    // jsdom doesn't support navigation; suppress the expected error
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'New dashboard' }));

    expect(reportInteraction).toHaveBeenCalledWith('grafana_menu_item_clicked', {
      url: '/dashboard/new',
      from: 'quickadd',
    });
    consoleSpy.mockRestore();
  });

  it('falls back to nav item text for unknown item IDs', async () => {
    setup([
      {
        text: 'Custom Section',
        id: 'custom',
        url: '/custom',
        children: [{ text: 'Custom action', id: 'custom/action', url: '/custom/new', isCreateAction: true }],
      },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(screen.getByRole('menuitem', { name: 'Custom action' })).toBeInTheDocument();
  });

  describe('From template button', () => {
    beforeEach(() => {
      config.featureToggles.dashboardTemplates = true;
    });

    it('shows when the feature flag is enabled', async () => {
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      expect(screen.getByRole('menuitem', { name: 'Dashboard from template' })).toBeInTheDocument();
    });

    it('is hidden when the feature flag is disabled', async () => {
      config.featureToggles.dashboardTemplates = false;
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      expect(screen.queryByRole('menuitem', { name: 'Dashboard from template' })).not.toBeInTheDocument();
    });

    it('links to the template dashboards page', async () => {
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      const link = screen.getByRole('menuitem', { name: 'Dashboard from template' });
      expect(link).toHaveAttribute('href', '/dashboards?templateDashboards=true&source=quickAdd');
    });

    it('is placed in the dashboard group', async () => {
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'New' }));

      const dashboardGroup = screen.getByRole('group', { name: 'Dashboards' });
      expect(within(dashboardGroup).getByRole('menuitem', { name: 'Dashboard from template' })).toBeInTheDocument();
    });
  });
});
