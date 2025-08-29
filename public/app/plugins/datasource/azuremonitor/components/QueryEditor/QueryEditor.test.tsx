import { render, screen, waitFor, cleanup } from '@testing-library/react';

import { CoreApp } from '@grafana/data';
import { config } from '@grafana/runtime';
// eslint-disable-next-line no-restricted-imports
import * as ui from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import createMockDatasource from '../../mocks/datasource';
import { invalidNamespaceError } from '../../mocks/errors';
import createMockQuery from '../../mocks/query';
import { AzureQueryType, ResultFormat } from '../../types/query';
import { selectOptionInTest } from '../../utils/testUtils';
import { createMockResourcePickerData } from '../LogsQueryEditor/mocks';

import QueryEditor from './QueryEditor';

// Have to mock CodeEditor because it doesnt seem to work in tests???
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual<typeof ui>('@grafana/ui'),
  CodeEditor: function CodeEditor({ value }: { value: string }) {
    return <pre>{value}</pre>;
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: (val: string) => {
      if (val === '$ws') {
        return '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace';
      }
      return val;
    },
    getVariables: () => [
      { name: 'var1', current: { value: 'value1' } },
      { name: 'var2', current: { value: 'value2' } },
    ],
  }),
}));

describe('Azure Monitor QueryEditor', () => {
  beforeEach(() => {
    config.featureToggles = {};
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('renders the Metrics query editor when the query type is Metrics', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.AzureMonitor,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() =>
      expect(
        screen.getByTestId(selectors.components.queryEditor.metricsQueryEditor.container.input)
      ).toBeInTheDocument()
    );
  });

  it('renders the Logs query editor when the query type is Logs', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.LogAnalytics,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() =>
      expect(screen.queryByTestId(selectors.components.queryEditor.logsQueryEditor.container.input)).toBeInTheDocument()
    );
  });

  it('renders the Logs code editor when there is an existing query and the builder is enabled', async () => {
    config.featureToggles.azureMonitorLogsBuilderEditor = true;
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.LogAnalytics,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() => {
      expect(
        screen.queryByTestId(selectors.components.queryEditor.logsQueryEditor.container.input)
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId(selectors.components.queryEditor.logsQueryBuilder.container.input)
      ).not.toBeInTheDocument();
    });
  });

  it('renders the Logs code editor when there is no existing query and the builder is disabled', async () => {
    config.featureToggles.azureMonitorLogsBuilderEditor = false;
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.LogAnalytics,
    };
    delete mockQuery.azureLogAnalytics?.query;

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() => {
      expect(
        screen.queryByTestId(selectors.components.queryEditor.logsQueryEditor.container.input)
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId(selectors.components.queryEditor.logsQueryBuilder.container.input)
      ).not.toBeInTheDocument();
    });
  });

  it('renders the Logs builder when there is no existing query and the builder is enabled', async () => {
    config.featureToggles.azureMonitorLogsBuilderEditor = true;
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.LogAnalytics,
    };
    delete mockQuery.azureLogAnalytics?.query;

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() => {
      expect(
        screen.queryByTestId(selectors.components.queryEditor.logsQueryEditor.container.input)
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId(selectors.components.queryEditor.logsQueryBuilder.container.input)
      ).not.toBeInTheDocument();
    });
  });

  it('renders the ARG query editor when the query type is ARG', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.AzureResourceGraph,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() =>
      expect(screen.queryByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)).toBeInTheDocument()
    );
  });

  it('renders the Traces query editor when the query type is Traces', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.AzureTraces,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() =>
      expect(
        screen.queryByTestId(selectors.components.queryEditor.tracesQueryEditor.container.input)
      ).toBeInTheDocument()
    );
  });

  it('changes the query type when selected', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = createMockQuery();
    const onChange = jest.fn();
    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={onChange} onRunQuery={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('azure-monitor-query-editor')).toBeInTheDocument());

    const metrics = await screen.findByLabelText(/Service/);
    await selectOptionInTest(metrics, 'Logs');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        refId: mockQuery.refId,
        datasource: mockQuery.datasource,
        queryType: AzureQueryType.LogAnalytics,
      })
    );
  });

  it('displays error messages from frontend Azure calls', async () => {
    const mockDatasource = createMockDatasource();
    mockDatasource.azureMonitorDatasource.getMetricNamespaces = jest.fn().mockRejectedValue(invalidNamespaceError());
    render(
      <QueryEditor query={createMockQuery()} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />
    );
    await waitFor(() =>
      expect(
        screen.getByTestId(selectors.components.queryEditor.metricsQueryEditor.container.input)
      ).toBeInTheDocument()
    );
    expect(screen.getByText('An error occurred while requesting metadata from Azure Monitor')).toBeInTheDocument();
  });

  it('should render the experimental QueryHeader when feature toggle is enabled', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.AzureMonitor,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);

    await waitFor(() =>
      expect(screen.getByTestId('data-testid azure-monitor-experimental-header')).toBeInTheDocument()
    );
  });

  it('renders the Metrics query editor when the data source is configured for user auth and the user is authenticated with Azure', async () => {
    jest.mocked(config).bootData.user.authenticatedBy = 'oauth_azuread';
    const mockDatasource = createMockDatasource({ currentUserAuth: true });
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.AzureMonitor,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() =>
      expect(
        screen.getByTestId(selectors.components.queryEditor.metricsQueryEditor.container.input)
      ).toBeInTheDocument()
    );
  });

  it('renders the user auth alert when the data source is configured for user auth and the user is not authenticated with Azure', async () => {
    jest.mocked(config).bootData.user.authenticatedBy = 'not_azuread';
    const mockDatasource = createMockDatasource({ currentUserAuth: true });
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.AzureMonitor,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() => expect(screen.getByTestId(selectors.components.queryEditor.userAuthAlert)).toBeInTheDocument());
  });

  it('renders the user auth fallback alert when the data source is configured for user auth and fallback credentials are disabled', async () => {
    jest.mocked(config).azure.userIdentityFallbackCredentialsEnabled = false;
    const mockDatasource = createMockDatasource({ currentUserAuth: true });
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.AzureMonitor,
    };

    render(
      <QueryEditor
        app={CoreApp.UnifiedAlerting}
        query={mockQuery}
        datasource={mockDatasource}
        onChange={() => {}}
        onRunQuery={() => {}}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId(selectors.components.queryEditor.userAuthFallbackAlert)).toBeInTheDocument()
    );
  });

  it('renders the user auth fallback alert when the data source is configured for user auth and fallback credentials are enabled but the data source has none', async () => {
    jest.mocked(config).azure.userIdentityFallbackCredentialsEnabled = true;
    const mockDatasource = createMockDatasource({ currentUserAuth: true });
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.AzureMonitor,
    };

    render(
      <QueryEditor
        app={CoreApp.UnifiedAlerting}
        query={mockQuery}
        datasource={mockDatasource}
        onChange={() => {}}
        onRunQuery={() => {}}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId(selectors.components.queryEditor.userAuthFallbackAlert)).toBeInTheDocument()
    );
  });

  it('should display the default subscription for exemplar type queries', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const defaultSubscriptionId = 'default-subscription-id';
    mockDatasource.azureLogAnalyticsDatasource.getDefaultOrFirstSubscription = jest
      .fn()
      .mockResolvedValue(defaultSubscriptionId);
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureTraces;
    query.queryType = AzureQueryType.TraceExemplar;
    query.query = 'test-operation-id';
    const onChange = jest.fn();

    render(<QueryEditor query={query} datasource={mockDatasource} onChange={onChange} onRunQuery={() => {}} />);

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          azureTraces: {
            operationId: query.query,
            resultFormat: ResultFormat.Trace,
            resources: [`/subscriptions/${defaultSubscriptionId}`],
          },
        })
      )
    );
    await waitFor(() => expect(screen.getByText(defaultSubscriptionId)).toBeInTheDocument());
    expect(await screen.getByDisplayValue('test-operation-id')).toBeInTheDocument();
  });
});
