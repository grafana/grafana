import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp, LoadingState, PanelData } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';

import { AzureQueryType, LogsEditorMode } from '../../dataquery.gen';
import { selectors } from '../../e2e/selectors';
import createMockQuery from '../../mocks/query';
import { AzureMonitorQuery } from '../../types/query';
import { selectOptionInTest } from '../../utils/testUtils';

import { QueryHeader } from './QueryHeader';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

describe('Azure Monitor QueryHeader', () => {
  const setAzureLogsCheatSheetModalOpen = jest.fn();
  const onRunQuery = jest.fn();

  const renderComponent = (query: AzureMonitorQuery, props?: Partial<React.ComponentProps<typeof QueryHeader>>) => {
    return render(
      <QueryHeader
        query={query}
        onQueryChange={props?.onQueryChange ?? jest.fn()}
        setAzureLogsCheatSheetModalOpen={setAzureLogsCheatSheetModalOpen}
        data={props?.data}
        onRunQuery={onRunQuery}
        app={props?.app}
      />
    );
  };

  beforeEach(() => {
    config.featureToggles = {};
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('renders the service selector', async () => {
    const query = createMockQuery();

    renderComponent(query);

    expect(screen.getByTestId(selectors.components.queryEditor.header.select)).toBeInTheDocument();
    expect(screen.getByLabelText(/Service/i)).toBeInTheDocument();
  });

  it('changes query type when a new service is selected', async () => {
    const query = createMockQuery();
    const onQueryChange = jest.fn();

    renderComponent(query, { onQueryChange });

    const serviceSelect = await screen.findByLabelText(/Service/i);

    await selectOptionInTest(serviceSelect, 'Logs');

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenCalled();
    });

    const lastCall = onQueryChange.mock.calls[onQueryChange.mock.calls.length - 1][0];

    expect(lastCall).toEqual(
      expect.objectContaining({
        queryType: AzureQueryType.LogAnalytics,
      })
    );
  });

  it('initializes logs editor mode to Raw when a raw query exists and builder is enabled', async () => {
    config.featureToggles.azureMonitorLogsBuilderEditor = true;

    const query: AzureMonitorQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.LogAnalytics,
      azureLogAnalytics: {
        query: 'SecurityEvent | take 10',
      },
    };

    const onQueryChange = jest.fn();

    renderComponent(query, { onQueryChange });

    await waitFor(() =>
      expect(onQueryChange).toHaveBeenCalledWith(
        expect.objectContaining({
          azureLogAnalytics: expect.objectContaining({
            mode: LogsEditorMode.Raw,
          }),
        })
      )
    );
  });

  it('renders the logs editor mode radio buttons when builder is enabled', async () => {
    config.featureToggles.azureMonitorLogsBuilderEditor = true;

    const query: AzureMonitorQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.LogAnalytics,
      azureLogAnalytics: {
        mode: LogsEditorMode.Builder,
      },
    };

    renderComponent(query);

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();

    expect(screen.getByLabelText('Builder')).toBeInTheDocument();
    expect(screen.getByLabelText('KQL')).toBeInTheDocument();
  });

  it('shows the kick start button when in Logs + Raw mode', async () => {
    const query: AzureMonitorQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.LogAnalytics,
      azureLogAnalytics: {
        mode: LogsEditorMode.Raw,
      },
    };

    renderComponent(query);

    expect(screen.getByRole('button', { name: /Kick start your query/i })).toBeInTheDocument();
  });

  it('opens the logs cheat sheet modal and reports interaction when kick start button is clicked', async () => {
    const user = userEvent.setup();

    const query: AzureMonitorQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.LogAnalytics,
      azureLogAnalytics: {
        mode: LogsEditorMode.Raw,
      },
    };

    renderComponent(query);

    await user.click(screen.getByRole('button', { name: /Kick start your query/i }));

    expect(setAzureLogsCheatSheetModalOpen).toHaveBeenCalled();
    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_azure_logs_query_patterns_opened',
      expect.objectContaining({
        version: 'v2',
      })
    );
  });

  it('shows confirmation modal when switching from Raw to Builder with existing KQL', async () => {
    const user = userEvent.setup();
    config.featureToggles.azureMonitorLogsBuilderEditor = true;

    const query: AzureMonitorQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.LogAnalytics,
      azureLogAnalytics: {
        mode: LogsEditorMode.Raw,
        query: 'SecurityEvent | take 10',
      },
    };

    renderComponent(query);

    await user.click(screen.getByLabelText('Builder'));

    expect(screen.getByText(/Switch editor mode\?/i)).toBeInTheDocument();
  });

  it('applies mode change when confirming the switch modal', async () => {
    const user = userEvent.setup();
    config.featureToggles.azureMonitorLogsBuilderEditor = true;

    const query: AzureMonitorQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.LogAnalytics,
      azureLogAnalytics: {
        mode: LogsEditorMode.Raw,
        query: 'SecurityEvent | take 10',
      },
    };

    const onQueryChange = jest.fn();

    renderComponent(query, { onQueryChange });

    await user.click(screen.getByLabelText('Builder'));
    await user.click(screen.getByText(/Switch to Builder/i));

    await waitFor(() =>
      expect(onQueryChange).toHaveBeenCalledWith(
        expect.objectContaining({
          azureLogAnalytics: expect.objectContaining({
            mode: LogsEditorMode.Builder,
            query: undefined,
          }),
        })
      )
    );
  });

  it('renders the Run query button in Builder mode when not in Explore', async () => {
    config.featureToggles.azureMonitorLogsBuilderEditor = true;

    const query: AzureMonitorQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.LogAnalytics,
      azureLogAnalytics: {
        mode: LogsEditorMode.Builder,
      },
    };

    renderComponent(query, { app: CoreApp.Dashboard });

    expect(screen.getByTestId(selectors.components.queryEditor.logsQueryEditor.runQuery.button)).toBeInTheDocument();
  });

  it('disables the Run query button spinner while loading', async () => {
    config.featureToggles.azureMonitorLogsBuilderEditor = true;

    const query: AzureMonitorQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.LogAnalytics,
      azureLogAnalytics: {
        mode: LogsEditorMode.Builder,
      },
    };

    renderComponent(query, {
      app: CoreApp.Dashboard,
      data: { state: LoadingState.Loading } as PanelData,
    });

    expect(screen.getByTestId(selectors.components.queryEditor.logsQueryEditor.runQuery.button)).toBeInTheDocument();
  });
});
