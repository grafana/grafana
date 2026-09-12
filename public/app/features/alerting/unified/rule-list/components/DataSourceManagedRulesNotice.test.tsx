import { render, screen, waitFor } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockDataSource } from '../../mocks';
import { addPlugin } from '../../mocks/server/configure';
import { setupDataSources } from '../../testSetup/datasources';
import { pluginMeta } from '../../testSetup/plugins';
import { SupportedPlugin } from '../../types/pluginBridges';

import { DataSourceManagedRulesBanner, DataSourceManagedRulesInlineNotice } from './DataSourceManagedRulesNotice';

setupMswServer();

const MIMIR = mockDataSource({ name: 'Mimir', uid: 'mimir', type: 'prometheus', jsonData: { manageAlerts: true } });

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);
  setupDataSources(MIMIR);
});

function installPlugin() {
  addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);
}

describe('DataSourceManagedRulesBanner', () => {
  it('stays out of the way when the plugin is not installed', async () => {
    render(<DataSourceManagedRulesBanner />);

    // Nothing renders, so wait for the plugin probe to settle before concluding that.
    await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
    expect(screen.queryByText(/prometheus alerting plugin/i)).not.toBeInTheDocument();
  });

  it('counts the handed over data sources and links to them, carrying the search over', async () => {
    installPlugin();

    render(<DataSourceManagedRulesBanner />, {
      historyOptions: { initialEntries: ['/alerting/list?search=state%3Afiring'] },
    });

    expect(await screen.findByText('1 data source is managed by the Prometheus Alerting plugin')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /view rules in prometheus alerting/i });
    expect(link).toHaveAttribute('href', `/a/${SupportedPlugin.PrometheusAlerting}/rules?search=state%3Afiring`);
  });

  it('drops the search param when nothing has been searched for', async () => {
    installPlugin();

    render(<DataSourceManagedRulesBanner />);

    const link = await screen.findByRole('link', { name: /view rules in prometheus alerting/i });
    expect(link).toHaveAttribute('href', `/a/${SupportedPlugin.PrometheusAlerting}/rules`);
  });

  it('says nothing when there are no data source managed rules sources to talk about', async () => {
    installPlugin();
    setupDataSources();

    render(<DataSourceManagedRulesBanner />);

    await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
  });
});

describe('DataSourceManagedRulesInlineNotice', () => {
  it('shows the same count with a shorter link', async () => {
    installPlugin();
    setupDataSources(
      MIMIR,
      mockDataSource({ name: 'Loki', uid: 'loki', type: 'loki', jsonData: { manageAlerts: true } })
    );

    render(<DataSourceManagedRulesInlineNotice />);

    expect(await screen.findByText('2 data sources are managed by the Prometheus Alerting plugin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      `/a/${SupportedPlugin.PrometheusAlerting}/rules`
    );
  });
});
