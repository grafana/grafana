import { HttpResponse, http } from 'msw';
import { act, render, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { config } from '@grafana/runtime';
import server from '@grafana/test-utils/server';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockDataSource } from '../../mocks';
import { addPlugin, failPlugin, setPrometheusRules } from '../../mocks/server/configure';
import { alertingFactory } from '../../mocks/server/db';
import { setupDataSources } from '../../testSetup/datasources';
import { pluginMeta } from '../../testSetup/plugins';
import { SupportedPlugin } from '../../types/pluginBridges';

import { PrometheusAlertingBanner, getPrometheusAlertingBannerDismissedKey } from './PrometheusAlertingBanner';

setupMswServer();

const MIMIR = mockDataSource({ name: 'Mimir', uid: 'mimir', type: 'prometheus', jsonData: { manageAlerts: true } });
const orgId = config.bootData.user.orgId;

const ui = {
  managedTitle: byRole('status', { name: /datasource-managed alert rules are managed in prometheus alerting/i }),
  installTitle: byRole('status', { name: /install prometheus alerting to manage datasource-managed alert rules/i }),
  openLink: byRole('link', { name: /open prometheus alerting/i }),
  installLink: byRole('link', { name: /install prometheus alerting/i }),
  dismiss: byRole('button', { name: /close alert/i }),
};

function withOneDataSourceRule() {
  setPrometheusRules(MIMIR, [
    alertingFactory.prometheus.group.build({ rules: [alertingFactory.prometheus.rule.build()] }),
  ]);
}

beforeEach(() => {
  localStorage.clear();
  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);
  setupDataSources(MIMIR);
});

describe('PrometheusAlertingBanner', () => {
  it('offers to install the plugin when the stack has a data source-managed rule and the plugin is missing', async () => {
    withOneDataSourceRule();

    render(<PrometheusAlertingBanner />);

    expect(await ui.installTitle.find()).toBeInTheDocument();
    expect(ui.installLink.get()).toHaveAttribute('href', `/plugins/${SupportedPlugin.PrometheusAlerting}`);
    expect(ui.managedTitle.query()).not.toBeInTheDocument();
  });

  it('says where the rules are managed and links to the plugin rule list when the plugin is installed', async () => {
    withOneDataSourceRule();
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);

    render(<PrometheusAlertingBanner />);

    expect(await ui.managedTitle.find()).toBeInTheDocument();
    expect(ui.openLink.get()).toHaveAttribute('href', `/a/${SupportedPlugin.PrometheusAlerting}/rules`);
  });

  it('renders nothing once every data source has answered with no data source-managed rules', async () => {
    const rulesRequested = jest.fn();
    server.use(
      http.get(`/api/prometheus/${MIMIR.uid}/api/v1/rules`, () => {
        rulesRequested();
        return HttpResponse.json({ status: 'success', data: { groups: [] } });
      })
    );

    const { container } = render(<PrometheusAlertingBanner />);

    await waitFor(() => expect(rulesRequested).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the plugin check fails, so "install" is never shown to someone who may have it', async () => {
    withOneDataSourceRule();
    failPlugin(SupportedPlugin.PrometheusAlerting);
    const settingsRequested = jest.fn();
    server.use(
      http.get(`/api/plugins/${SupportedPlugin.PrometheusAlerting}/settings`, () => {
        settingsRequested();
        return HttpResponse.json({ message: 'Internal server error' }, { status: 500 });
      })
    );

    const { container } = render(<PrometheusAlertingBanner />);

    await waitFor(() => expect(settingsRequested).toHaveBeenCalled());
    await act(() => Promise.resolve());
    expect(container).toBeEmptyDOMElement();
  });

  it('hides the banner when dismissed and remembers that for this org', async () => {
    withOneDataSourceRule();
    const { user } = render(<PrometheusAlertingBanner />);

    await user.click(await ui.dismiss.find());

    expect(ui.installTitle.query()).not.toBeInTheDocument();
    expect(localStorage.getItem(getPrometheusAlertingBannerDismissedKey(orgId, 'install'))).toBe('true');
  });

  it('still shows the "managed" banner after the plugin is installed, when only "install" was dismissed', async () => {
    withOneDataSourceRule();
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);
    localStorage.setItem(getPrometheusAlertingBannerDismissedKey(orgId, 'install'), 'true');

    render(<PrometheusAlertingBanner />);

    expect(await ui.managedTitle.find()).toBeInTheDocument();
  });
});
