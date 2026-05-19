import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { ALERTING_API_SERVER_BASE_URL, getK8sResponse } from 'app/features/alerting/unified/mocks/server/utils';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { DOCS_URL_INHIBITION_RULES } from 'app/features/alerting/unified/utils/docs';

import { InhibitionRulesAlert } from './InhibitionRulesAlert';

const server = setupMswServer();

function setInhibitionRulesResponse(items: Array<{ name: string; equal?: string[] }>) {
  const k8sItems = items.map((item) => ({
    apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
    kind: 'InhibitionRule',
    metadata: { name: item.name, namespace: 'default' },
    spec: { equal: item.equal ?? ['alertname'] },
  }));

  server.use(
    http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/inhibitionrules`, () =>
      HttpResponse.json(getK8sResponse('InhibitionRuleList', k8sItems))
    )
  );
}

describe('InhibitionRulesAlert', () => {
  it('should not render when there are no inhibition rules', async () => {
    const { container } = render(<InhibitionRulesAlert alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('should render alert when inhibition rules are configured', async () => {
    setInhibitionRulesResponse([{ name: 'rule-1' }]);

    render(<InhibitionRulesAlert alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Inhibition rules are in effect')).toBeInTheDocument();
    expect(screen.getByText(/This Alertmanager has inhibition rules configured/i)).toBeInTheDocument();
  });

  it('should include a link to documentation', async () => {
    setInhibitionRulesResponse([{ name: 'rule-1' }]);

    render(<InhibitionRulesAlert alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME} />);

    const link = await screen.findByRole('link', { name: /Learn more about inhibition rules/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', DOCS_URL_INHIBITION_RULES);
  });

  it('should not render when alertmanagerSourceName is empty', async () => {
    const { container } = render(<InhibitionRulesAlert alertmanagerSourceName="" />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('should not render when fetching inhibition rules fails', async () => {
    server.use(
      http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/inhibitionrules`, () =>
        HttpResponse.json({ message: 'error' }, { status: 500 })
      )
    );

    const { container } = render(<InhibitionRulesAlert alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('should not render for non-Grafana alertmanager sources', async () => {
    setInhibitionRulesResponse([{ name: 'rule-1' }]);

    const { container } = render(<InhibitionRulesAlert alertmanagerSourceName="some-external-am" />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
