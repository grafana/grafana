import { screen } from '@testing-library/react';
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

const setup = (overrides?: { navBarTree?: NavModelItem[] }) => {
  const navBarTree: NavModelItem[] = overrides?.navBarTree ?? [
    {
      text: 'Dashboards',
      id: 'dashboards',
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

  it('shows grouped dashboard and alert items when clicked', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));

    expect(screen.getByText('New dashboard')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Blank' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Import' })).toBeInTheDocument();

    expect(screen.getByText('New alert rule')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Create' })).toBeInTheDocument();
  });

  it('reports interaction when a menu item is clicked', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Blank' }));

    expect(reportInteraction).toHaveBeenCalledWith('grafana_menu_item_clicked', {
      url: '/dashboard/new',
      from: 'quickadd',
    });
    consoleError.mockRestore();
  });

  it('reports interaction for alert rule create', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Create' }));

    expect(reportInteraction).toHaveBeenCalledWith('grafana_menu_item_clicked', {
      url: '/alerting/new',
      from: 'quickadd',
    });
    consoleError.mockRestore();
  });

  it('does not render when no create actions exist', () => {
    setup({
      navBarTree: [{ text: 'Home', id: 'home', url: '/', children: [] }],
    });
    expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
  });

  describe('From template button', () => {
    beforeEach(() => {
      config.featureToggles.dashboardTemplates = true;
    });

    it('shows a `From template` button when the feature flag is enabled', async () => {
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      expect(screen.getByRole('menuitem', { name: 'From template' })).toBeInTheDocument();
    });

    it('does not show a `From template` button when the feature flag is disabled', async () => {
      config.featureToggles.dashboardTemplates = false;
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      expect(screen.queryByRole('menuitem', { name: 'From template' })).not.toBeInTheDocument();
    });

    it('links to the template dashboard page', async () => {
      setup();

      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      const link = screen.getByRole('menuitem', { name: 'From template' });
      expect(link).toHaveAttribute('href', '/dashboards?templateDashboards=true&source=quickAdd');
    });
  });
});
