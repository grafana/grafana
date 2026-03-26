import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { ALERTING_API_SERVER_BASE_URL, getK8sResponse } from 'app/features/alerting/unified/mocks/server/utils';
import { DOCS_URL_INHIBITION_RULES } from 'app/features/alerting/unified/utils/docs';

import { InhibitionDetails } from './InhibitionDetails';

const server = setupMswServer();

type InhibitionRuleItem = {
  name: string;
  source_matchers?: Array<{ label: string; type: '=' | '!=' | '=~' | '!~'; value: string }>;
  target_matchers?: Array<{ label: string; type: '=' | '!=' | '=~' | '!~'; value: string }>;
};

function setInhibitionRulesResponse(items: InhibitionRuleItem[]) {
  const k8sItems = items.map((item) => ({
    apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
    kind: 'InhibitionRule',
    metadata: { name: item.name, namespace: 'default' },
    spec: {
      source_matchers: item.source_matchers,
      target_matchers: item.target_matchers,
    },
  }));

  server.use(
    http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/inhibitionrules`, () =>
      HttpResponse.json(getK8sResponse('InhibitionRuleList', k8sItems))
    )
  );
}

describe('InhibitionDetails', () => {
  it('should not render when there are no inhibition rules', async () => {
    const { container } = render(<InhibitionDetails labels={{ severity: 'critical' }} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('should not render when labels do not match any inhibition rule', async () => {
    setInhibitionRulesResponse([
      {
        name: 'rule-1',
        target_matchers: [{ label: 'severity', type: '=', value: 'warning' }],
      },
    ]);

    const { container } = render(<InhibitionDetails labels={{ severity: 'critical' }} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('should render a warning alert when rule labels match target_matchers', async () => {
    setInhibitionRulesResponse([
      {
        name: 'rule-1',
        source_matchers: [{ label: 'severity', type: '=', value: 'critical' }],
        target_matchers: [{ label: 'severity', type: '=', value: 'warning' }],
      },
    ]);

    render(<InhibitionDetails labels={{ severity: 'warning' }} />);

    expect(await screen.findByRole('alert', { name: /may be suppressed by/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert', { name: /may suppress alerts matched by/i })).not.toBeInTheDocument();
  });

  it('should render an info alert when rule labels match source_matchers', async () => {
    setInhibitionRulesResponse([
      {
        name: 'rule-1',
        source_matchers: [{ label: 'severity', type: '=', value: 'critical' }],
        target_matchers: [{ label: 'severity', type: '=', value: 'warning' }],
      },
    ]);

    render(<InhibitionDetails labels={{ severity: 'critical' }} />);

    // severity="info" renders role="status" in Grafana's Alert component
    expect(await screen.findByRole('status', { name: /may suppress alerts matched by/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert', { name: /may be suppressed by/i })).not.toBeInTheDocument();
  });

  it('should render two separate alerts when labels match both source and target matchers', async () => {
    setInhibitionRulesResponse([
      {
        name: 'rule-1',
        source_matchers: [{ label: 'team', type: '=', value: 'ops' }],
        target_matchers: [{ label: 'team', type: '=', value: 'ops' }],
      },
    ]);

    render(<InhibitionDetails labels={{ team: 'ops' }} />);

    // severity="warning" renders role="alert"; severity="info" renders role="status"
    expect(await screen.findByRole('alert', { name: /may be suppressed by/i })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /may suppress alerts matched by/i })).toBeInTheDocument();
  });

  it('should show correct count in the target alert title for multiple matching rules', async () => {
    setInhibitionRulesResponse([
      {
        name: 'rule-1',
        target_matchers: [{ label: 'severity', type: '=', value: 'warning' }],
      },
      {
        name: 'rule-2',
        target_matchers: [{ label: 'env', type: '=', value: 'production' }],
      },
    ]);

    render(<InhibitionDetails labels={{ severity: 'warning', env: 'production' }} />);

    expect(await screen.findByRole('alert', { name: /suppressed by 2 inhibition rule/i })).toBeInTheDocument();
  });

  it('should include a link to the inhibition rules documentation in each rendered alert', async () => {
    setInhibitionRulesResponse([
      {
        name: 'rule-1',
        source_matchers: [{ label: 'team', type: '=', value: 'ops' }],
        target_matchers: [{ label: 'team', type: '=', value: 'ops' }],
      },
    ]);

    render(<InhibitionDetails labels={{ team: 'ops' }} />);

    await screen.findAllByRole('alert');
    const links = screen.getAllByRole('link', { name: /Learn more about inhibition rules/i });
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link).toHaveAttribute('href', DOCS_URL_INHIBITION_RULES));
  });

  it('should not render when the API call fails', async () => {
    server.use(
      http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/inhibitionrules`, () =>
        HttpResponse.json({ message: 'error' }, { status: 500 })
      )
    );

    const { container } = render(<InhibitionDetails labels={{ severity: 'critical' }} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
