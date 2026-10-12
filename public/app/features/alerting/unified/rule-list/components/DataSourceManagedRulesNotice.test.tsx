import { render, screen, waitFor } from 'test/test-utils';

import { config, setReturnToPreviousHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockDataSource } from '../../mocks';
import { addPlugin } from '../../mocks/server/configure';
import { setupDataSources } from '../../testSetup/datasources';
import { pluginMeta } from '../../testSetup/plugins';
import { setupPrometheusAlertingPlugin } from '../../testSetup/prometheusAlertingPlugin';
import { SupportedPlugin } from '../../types/pluginBridges';

import { DataSourceManagedRulesBanner, DataSourceManagedRulesInlineNotice } from './DataSourceManagedRulesNotice';

setupMswServer();

const MIMIR = mockDataSource({ name: 'Mimir', uid: 'mimir', type: 'prometheus', jsonData: { manageAlerts: true } });
const returnToPrevious = jest.fn();

setReturnToPreviousHook(() => returnToPrevious);

beforeEach(() => {
  returnToPrevious.mockClear();
  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);
  setupDataSources(MIMIR);
});

describe('DataSourceManagedRulesBanner', () => {
  it('stays out of the way when the plugin is not installed', async () => {
    render(<DataSourceManagedRulesBanner />);

    // Nothing renders, so wait for the plugin probe to settle before concluding that.
    await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
    expect(screen.queryByText(/prometheus alerting plugin/i)).not.toBeInTheDocument();
  });

  it('stays out of the way while the route proxy is switched off, even with the plugin installed', async () => {
    // Nothing redirects to the plugin in this state, so hiding rules here would leave them nowhere.
    const unifiedAlertingEnabled = config.unifiedAlertingEnabled;
    config.unifiedAlertingEnabled = true;
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);

    try {
      render(<DataSourceManagedRulesBanner />);

      await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
      expect(screen.queryByText(/prometheus alerting plugin/i)).not.toBeInTheDocument();
    } finally {
      config.unifiedAlertingEnabled = unifiedAlertingEnabled;
    }
  });
});

describe('DataSourceManagedRulesBanner with the Prometheus Alerting plugin', () => {
  setupPrometheusAlertingPlugin();

  it('counts the handed over data sources and links to them, carrying the search over', async () => {
    render(<DataSourceManagedRulesBanner />, {
      historyOptions: { initialEntries: ['/alerting/list?search=state%3Afiring'] },
    });

    expect(await screen.findByText('1 data source is managed by the Prometheus Alerting plugin')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /view rules in prometheus alerting/i });
    expect(link).toHaveAttribute('href', `/a/${SupportedPlugin.PrometheusAlerting}/rules?search=state%3Afiring`);
  });

  it('drops the search param when nothing has been searched for', async () => {
    render(<DataSourceManagedRulesBanner />);

    const link = await screen.findByRole('link', { name: /view rules in prometheus alerting/i });
    expect(link).toHaveAttribute('href', `/a/${SupportedPlugin.PrometheusAlerting}/rules`);
  });

  it('says nothing when there are no data source managed rules sources to talk about', async () => {
    setupDataSources();

    render(<DataSourceManagedRulesBanner />);

    await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
  });
});

describe('DataSourceManagedRulesInlineNotice', () => {
  setupPrometheusAlertingPlugin();

  it('shows the same count with a shorter link that records where to return', async () => {
    setupDataSources(
      MIMIR,
      mockDataSource({ name: 'Loki', uid: 'loki', type: 'loki', jsonData: { manageAlerts: true } })
    );

    const { user } = render(<DataSourceManagedRulesInlineNotice />);

    expect(await screen.findByText('2 data sources are managed by the Prometheus Alerting plugin')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'View' });
    expect(link).toHaveAttribute('href', `/a/${SupportedPlugin.PrometheusAlerting}/rules`);
    link.addEventListener('click', (event) => event.preventDefault());
    await user.click(link);
    expect(returnToPrevious).toHaveBeenCalledWith('Alert rules');
  });
});
