import { produce } from 'immer';
import { render, screen, waitFor } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { makeAllAlertmanagerConfigFetchFail } from 'app/features/alerting/unified/mocks/server/configure';
import {
  getAlertmanagerConfig,
  setAlertmanagerConfig,
} from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { InhibitionRulesAlert } from './InhibitionRulesAlert';

setupMswServer();

describe('InhibitionRulesAlert', () => {
  beforeEach(() => {
    // Reset to a config without inhibition rules by default
    const config = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);
    const configWithoutInhibitRules = produce(config, (draft) => {
      draft.alertmanager_config.inhibit_rules = [];
    });
    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, configWithoutInhibitRules);
  });

  it('should not render when there are no inhibition rules', async () => {
    const { container } = render(<InhibitionRulesAlert alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('should render alert when inhibition rules are configured', async () => {
    const config = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);
    const configWithInhibitRules = produce(config, (draft) => {
      draft.alertmanager_config.inhibit_rules = [
        {
          source_match: { severity: 'critical' },
          target_match: { severity: 'warning' },
          equal: ['alertname'],
        },
      ];
    });
    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, configWithInhibitRules);

    render(<InhibitionRulesAlert alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME} />);

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Inhibition rules are in effect')).toBeInTheDocument();
    expect(screen.getByText(/This Alertmanager has inhibition rules configured/i)).toBeInTheDocument();
  });

  it('should include a link to documentation', async () => {
    const config = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);
    const configWithInhibitRules = produce(config, (draft) => {
      draft.alertmanager_config.inhibit_rules = [
        {
          source_match: { severity: 'critical' },
          target_match: { severity: 'warning' },
          equal: ['alertname'],
        },
      ];
    });
    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, configWithInhibitRules);

    render(<InhibitionRulesAlert alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME} />);

    const link = await screen.findByRole('link', { name: /Learn more about inhibition rules/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      'https://grafana.com/docs/grafana/latest/alerting/configure-notifications/create-silence/#inhibition-rules'
    );
  });

  it('should not render when alertmanagerSourceName is empty', async () => {
    const { container } = render(<InhibitionRulesAlert alertmanagerSourceName="" />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('should not render when fetching config fails', async () => {
    makeAllAlertmanagerConfigFetchFail();

    const { container } = render(<InhibitionRulesAlert alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
