import { HttpResponse, http } from 'msw';
import { render, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { config } from '@grafana/runtime';
import server from '@grafana/test-utils/server';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockDataSource } from '../../mocks';
import { addPlugin } from '../../mocks/server/configure';
import { setupDataSources } from '../../testSetup/datasources';
import { pluginMeta } from '../../testSetup/plugins';
import { SupportedPlugin } from '../../types/pluginBridges';

import { PrometheusAlertingBanner, getPrometheusAlertingBannerDismissedKey } from './PrometheusAlertingBanner';

setupMswServer();

const MIMIR = mockDataSource({ name: 'Mimir', uid: 'mimir', type: 'prometheus', jsonData: { manageAlerts: true } });
const orgId = config.bootData.user.orgId;

const ui = {
  managedTitle: byRole('status', { name: /datasource-managed alert rules are managed in prometheus alerting/i }),
  installTitle: byRole('status', {
    name: /install the prometheus alerting plugin to manage data source-managed rules/i,
  }),
  openLink: byRole('link', { name: /open prometheus alerting/i }),
  installLink: byRole('link', { name: /install prometheus alerting/i }),
  dismiss: byRole('button', { name: /close alert/i }),
};

beforeEach(() => {
  localStorage.clear();
  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);
  setupDataSources(MIMIR);
});

describe('PrometheusAlertingBanner', () => {
  it('offers to install the plugin when the stack has a data source that can hold rules and the plugin is missing', async () => {
    render(<PrometheusAlertingBanner />);

    expect(await ui.installTitle.find()).toBeInTheDocument();
    expect(ui.installLink.get()).toHaveAttribute('href', `/plugins/${SupportedPlugin.PrometheusAlerting}`);
    expect(ui.managedTitle.query()).not.toBeInTheDocument();
  });

  it('says where the rules are managed and links to the plugin rule list when the plugin is installed', async () => {
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);

    render(<PrometheusAlertingBanner />);

    expect(await ui.managedTitle.find()).toBeInTheDocument();
    expect(ui.openLink.get()).toHaveAttribute('href', `/a/${SupportedPlugin.PrometheusAlerting}/rules`);
  });

  it('renders nothing when no data source can hold rules', async () => {
    setupDataSources(
      mockDataSource({ name: 'Plain', uid: 'plain', type: 'prometheus', jsonData: { manageAlerts: false } })
    );

    const { container } = render(<PrometheusAlertingBanner />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('asks for neither the data sources rules nor the legacy plugin settings', async () => {
    const requested = jest.fn();
    server.use(
      http.get(`/api/prometheus/${MIMIR.uid}/api/v1/rules`, () => {
        requested('rules');
        return HttpResponse.json({ status: 'success', data: { groups: [] } });
      }),
      http.get(`/api/plugins/${SupportedPlugin.PrometheusAlerting}/settings`, () => {
        requested('settings');
        return HttpResponse.json(pluginMeta[SupportedPlugin.PrometheusAlerting]);
      })
    );
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);

    render(<PrometheusAlertingBanner />);

    expect(await ui.managedTitle.find()).toBeInTheDocument();
    expect(requested).not.toHaveBeenCalled();
  });

  it('hides the banner when dismissed and remembers that for this org', async () => {
    const { user } = render(<PrometheusAlertingBanner />);

    await user.click(await ui.dismiss.find());

    expect(ui.installTitle.query()).not.toBeInTheDocument();
    expect(localStorage.getItem(getPrometheusAlertingBannerDismissedKey(orgId, 'install'))).toBe('true');
  });

  it('still shows the "managed" banner after the plugin is installed, when only "install" was dismissed', async () => {
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);
    localStorage.setItem(getPrometheusAlertingBannerDismissedKey(orgId, 'install'), 'true');

    render(<PrometheusAlertingBanner />);

    expect(await ui.managedTitle.find()).toBeInTheDocument();
  });
});
