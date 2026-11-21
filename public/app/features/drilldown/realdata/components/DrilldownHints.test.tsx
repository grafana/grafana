import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { useAssistant } from '@grafana/assistant';
import { PluginExtensionPoints, PluginExtensionTypes } from '@grafana/data';
import { locationService, usePluginLinks } from '@grafana/runtime';

import { type Hint } from '../liveScenario';

import { DrilldownHints } from './DrilldownHints';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn((type: string, params: object) => ({ type, params })),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn(),
}));

const openAssistant = jest.fn();
const hint: Hint = {
  id: 'checkout-errors',
  title: 'Errors detected in checkout',
  description: '12 error logs · prod · shop',
  severity: 'errors',
  scope: { type: 'service', value: 'checkout', env: 'prod', namespace: 'shop' },
  investigable: true,
  trend: [],
  trendLabel: '',
  timeRange: { from: 1_700_000_000_000, to: 1_700_001_800_000 },
  evidence: [{ signal: 'logs', datasourceUid: 'logs-1', query: '{service_name="checkout"}', summary: '12 error logs' }],
};

const paginatedHints: Hint[] = Array.from({ length: 9 }, (_, index) => ({
  ...hint,
  id: `checkout-${index + 1}`,
  title: `Errors detected in checkout-${index + 1}`,
  scope: { ...hint.scope, value: `checkout-${index + 1}` },
}));

beforeEach(() => {
  openAssistant.mockReset();
  jest.mocked(usePluginLinks).mockReset().mockReturnValue({ isLoading: false, links: [] });
  jest.mocked(useAssistant).mockReturnValue({
    isLoading: false,
    isAvailable: true,
    openAssistant,
    closeAssistant: jest.fn(),
    toggleAssistant: jest.fn(),
  });
  locationService.replace(
    '/drilldown?var-ds-logs=logs-1&var-ds-metrics=metrics-1&var-ds-traces=traces-1&var-ds-sql=orders'
  );
});

it('counts distinct service scopes across all recommendation pages', async () => {
  const user = userEvent.setup();
  render(
    <DrilldownHints
      hints={[
        hint,
        { ...hint, id: 'checkout-latency', title: 'Checkout latency increased', severity: 'slow' },
        { ...hint, id: 'checkout-staging', scope: { ...hint.scope, env: 'staging' } },
        { ...hint, id: 'cart-errors', scope: { ...hint.scope, value: 'cart' } },
      ]}
    />
  );

  expect(screen.getByRole('heading', { name: 'Recommendations' })).toBeInTheDocument();
  expect(screen.getByText('3 services')).toBeInTheDocument();
  expect(screen.getByText('Detected in the last 30 minutes across your selected signals')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'next page' }));

  expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByText('3 services')).toBeInTheDocument();
});

it('uses the singular service count for multiple findings about the same service', () => {
  render(<DrilldownHints hints={[hint, { ...hint, id: 'checkout-latency', severity: 'slow' }]} />);

  expect(screen.getByText('1 service')).toBeInTheDocument();
});

it('pages through three findings at a time and investigates the selected finding on a later page', async () => {
  const user = userEvent.setup();
  render(<DrilldownHints hints={paginatedHints.slice(0, 6)} />);

  expect(screen.getAllByText(/^Errors detected in checkout-/).map((item) => item.textContent)).toEqual([
    'Errors detected in checkout-1',
    'Errors detected in checkout-2',
    'Errors detected in checkout-3',
  ]);
  await user.click(screen.getByRole('button', { name: 'next page' }));

  expect(screen.getAllByText(/^Errors detected in checkout-/).map((item) => item.textContent)).toEqual([
    'Errors detected in checkout-4',
    'Errors detected in checkout-5',
    'Errors detected in checkout-6',
  ]);
  expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
  await user.click(screen.getAllByRole('button', { name: /^Ask Grafana Assistant about/ })[2]);

  expect(openAssistant).toHaveBeenCalledWith(
    expect.objectContaining({
      prompt: expect.stringContaining('Explain this finding: Errors detected in checkout-6.'),
    })
  );
  await user.click(screen.getByRole('button', { name: 'previous page' }));

  expect(screen.getByText('Errors detected in checkout-1')).toBeInTheDocument();
  expect(screen.queryByText('Errors detected in checkout-5')).not.toBeInTheDocument();
});

it.each([0, 3])('hides pagination when %i findings fit on one page', (count) => {
  render(<DrilldownHints hints={paginatedHints.slice(0, count)} />);

  expect(screen.getByRole('heading', { name: 'Recommendations' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

it('clamps the current page when fewer findings are returned', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<DrilldownHints hints={paginatedHints} />);
  await user.click(screen.getByRole('button', { name: '3' }));

  expect(screen.getByText('Errors detected in checkout-9')).toBeInTheDocument();

  rerender(<DrilldownHints hints={paginatedHints.slice(0, 5)} />);

  expect(screen.getByText('Errors detected in checkout-5')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');

  rerender(<DrilldownHints hints={paginatedHints.slice(0, 2)} />);

  expect(screen.getByText('Errors detected in checkout-1')).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

it.each([
  {
    name: 'Logs',
    signal: 'logs' as const,
    pluginId: 'grafana-lokiexplore-app',
    datasourceType: 'loki',
    queryField: 'expr',
    query:
      '{service_name="checkout"} | deployment_environment_name="prod" | service_namespace="shop" | detected_level=~"(?i)error|err|fatal|critical"',
    severity: 'errors' as const,
  },
  {
    name: 'Logs',
    signal: 'logs' as const,
    pluginId: 'grafana-lokiexplore-app',
    datasourceType: 'loki',
    queryField: 'expr',
    query: '{service_name="checkout"} | deployment_environment_name="prod" | service_namespace="shop"',
    severity: 'slow' as const,
  },
  {
    name: 'Traces',
    signal: 'traces' as const,
    pluginId: 'grafana-exploretraces-app',
    datasourceType: 'tempo',
    queryField: 'query',
    query:
      '{ resource.service.name="checkout" && resource.deployment.environment.name="prod" && resource.service.namespace="shop" && status = error }',
    severity: 'errors' as const,
  },
  {
    name: 'Metrics',
    signal: 'metrics' as const,
    pluginId: 'grafana-metricsdrilldown-app',
    datasourceType: 'prometheus',
    queryField: 'expr',
    query:
      'traces_span_metrics_calls_total{span_kind="SPAN_KIND_SERVER",service_name="checkout",deployment_environment_name="prod",service_namespace="shop",status_code="STATUS_CODE_ERROR"}',
    severity: 'errors' as const,
  },
  {
    name: 'Metrics',
    signal: 'metrics' as const,
    pluginId: 'grafana-metricsdrilldown-app',
    datasourceType: 'prometheus',
    queryField: 'expr',
    query:
      'traces_span_metrics_duration_milliseconds_bucket{span_kind="SPAN_KIND_SERVER",service_name="checkout",deployment_environment_name="prod",service_namespace="shop"}',
    severity: 'slow' as const,
  },
])('links the View $name action for $severity to its app with the finding scope and time range', (testCase) => {
  const path = `/a/${testCase.pluginId}/finding`;
  jest.mocked(usePluginLinks).mockReturnValue({
    isLoading: false,
    links: [
      {
        id: 'unrelated',
        pluginId: 'another-plugin',
        type: PluginExtensionTypes.link,
        title: 'Another action',
        description: '',
        path: '/unrelated',
      },
      {
        id: 'drilldown',
        pluginId: testCase.pluginId,
        type: PluginExtensionTypes.link,
        title: 'Open Drilldown',
        description: '',
        path,
      },
    ],
  });
  render(
    <DrilldownHints
      hints={[
        {
          ...hint,
          severity: testCase.severity,
          evidence: [{ ...hint.evidence[0], signal: testCase.signal, datasourceUid: 'evidence-source' }],
        },
      ]}
    />,
    {
      wrapper: ({ children }) => (
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{children}</MemoryRouter>
      ),
    }
  );

  expect(screen.getByRole('link', { name: `Open ${testCase.name} Drilldown for checkout` })).toHaveAttribute(
    'href',
    path
  );
  expect(screen.getByRole('link', { name: `Open ${testCase.name} Drilldown for checkout` })).toHaveTextContent(
    `View ${testCase.signal}`
  );
  expect(usePluginLinks).toHaveBeenCalledWith({
    extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
    limitPerPlugin: 1,
    context: {
      targets: [
        {
          refId: 'A',
          datasource: { type: testCase.datasourceType, uid: 'evidence-source' },
          [testCase.queryField]: testCase.query,
        },
      ],
      timeRange: { from: '1700000000000', to: '1700001800000' },
      timeZone: 'utc',
    },
  });
});

it('disables the signal action when its Drilldown app is unavailable', () => {
  render(<DrilldownHints hints={[hint]} />);

  expect(screen.getByRole('button', { name: 'View logs' })).toBeDisabled();
  expect(screen.queryByRole('link', { name: 'Open Logs Drilldown for checkout' })).not.toBeInTheDocument();
});

it('shows the supporting signal and opens Assistant with the finding, scope and measured time range', async () => {
  render(<DrilldownHints hints={[hint]} />);

  expect(screen.getByRole('button', { name: 'View logs' })).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'Ask Grafana Assistant about Errors detected in checkout' })
  );

  expect(openAssistant).toHaveBeenCalledWith({
    origin: 'grafana/drilldown-home',
    prompt:
      'Explain this finding: Errors detected in checkout. Use the attached evidence and time range to summarize the likely impact, then recommend where to investigate further: Logs Drilldown for error messages and patterns, Traces Drilldown for failing or slow requests, or Metrics Drilldown for rates and trends. Prefer the supporting signals in the attached evidence; include other selected signals only when your investigation finds relevant evidence. Finish with a relevant Drilldown action.',
    autoSend: true,
    context: [
      { type: 'datasource', params: { datasourceUid: 'metrics-1' } },
      { type: 'datasource', params: { datasourceUid: 'logs-1' } },
      { type: 'datasource', params: { datasourceUid: 'traces-1' } },
      {
        type: 'entity',
        params: { type: 'Service', name: 'checkout', scope: { env: 'prod', namespace: 'shop' }, properties: undefined },
      },
      {
        type: 'structured',
        params: expect.objectContaining({
          title: 'Drilldown finding',
          data: expect.objectContaining({
            name: 'Drilldown finding',
            finding: {
              title: 'Errors detected in checkout',
              description: '12 error logs · prod · shop',
              severity: 'errors',
            },
            scope: { type: 'service', value: 'checkout', env: 'prod', namespace: 'shop' },
            timeRange: { from: '2023-11-14T22:13:20.000Z', to: '2023-11-14T22:43:20.000Z' },
            evidence: [
              { signal: 'logs', datasourceUid: 'logs-1', query: '{service_name="checkout"}', summary: '12 error logs' },
            ],
            drilldownDestinations: [{ type: 'drilldown_logs', datasourceUid: 'logs-1' }],
          }),
        }),
      },
    ],
  });
});

it('passes the matching Drilldown destinations for corroborating signals', async () => {
  render(
    <DrilldownHints
      hints={[
        {
          ...hint,
          evidence: [
            ...hint.evidence,
            { signal: 'metrics', datasourceUid: 'metrics-1', query: 'rate(errors[5m])', summary: '5% failed spans' },
            { signal: 'traces', datasourceUid: 'traces-1', query: '{ status = error }', summary: '2 error spans' },
          ],
        },
      ]}
    />
  );

  expect(screen.getByRole('button', { name: 'View logs' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'View metrics' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'View traces' })).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'Ask Grafana Assistant about Errors detected in checkout' })
  );

  expect(openAssistant).toHaveBeenCalledWith(
    expect.objectContaining({
      context: expect.arrayContaining([
        expect.objectContaining({
          type: 'structured',
          params: expect.objectContaining({
            data: expect.objectContaining({
              drilldownDestinations: [
                { type: 'drilldown_logs', datasourceUid: 'logs-1' },
                { type: 'drilldown_metrics', datasourceUid: 'metrics-1' },
                { type: 'drilldown_traces', datasourceUid: 'traces-1' },
              ],
            }),
          }),
        }),
      ]),
    })
  );
});

it.each([
  { state: 'loading', isLoading: true },
  { state: 'unavailable', isLoading: false },
])('hides detected findings while Assistant is $state and restores them when available', ({ isLoading }) => {
  const availableAssistant = {
    isLoading: false,
    isAvailable: true,
    openAssistant,
    closeAssistant: jest.fn(),
    toggleAssistant: jest.fn(),
  };
  const { rerender } = render(<DrilldownHints hints={[hint]} />);

  expect(screen.getByRole('heading', { name: 'Recommendations' })).toBeInTheDocument();

  jest.mocked(useAssistant).mockReturnValue({
    isLoading,
    isAvailable: false,
    openAssistant: undefined,
    closeAssistant: undefined,
    toggleAssistant: undefined,
  });

  rerender(<DrilldownHints hints={[hint]} />);

  expect(screen.queryByRole('heading', { name: 'Recommendations' })).not.toBeInTheDocument();
  expect(screen.queryByText('Errors detected in checkout')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Ask Grafana Assistant about/ })).not.toBeInTheDocument();

  jest.mocked(useAssistant).mockReturnValue(availableAssistant);
  rerender(<DrilldownHints hints={[hint]} />);

  expect(screen.getByRole('heading', { name: 'Recommendations' })).toBeInTheDocument();
  expect(screen.getByText('Errors detected in checkout')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ask Grafana Assistant about Errors detected in checkout' })).toBeEnabled();
});
