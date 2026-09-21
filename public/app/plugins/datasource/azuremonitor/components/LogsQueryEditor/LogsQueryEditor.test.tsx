import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTime, LoadingState } from '@grafana/data';
import { config } from '@grafana/runtime';
// eslint-disable-next-line no-restricted-imports
import type * as ui from '@grafana/ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  LogsEditorMode,
  ResultFormat,
} from '../../dataquery.gen';
import createMockDatasource from '../../mocks/datasource';
import createMockQuery from '../../mocks/query';
import { type EngineSchema, TablePlan } from '../../types/types';
import { selectOptionInTest } from '../../utils/testUtils';

import LogsQueryEditor from './LogsQueryEditor';
import { createMockResourcePickerData } from './mocks';

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

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual<typeof ui>('@grafana/ui'),
  CodeEditor: function CodeEditor({ value }: { value: string }) {
    return <pre>{value}</pre>;
  },
}));
const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

describe('LogsQueryEditor', () => {
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = function () {};
  });
  afterEach(() => {
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('should select multiple resources', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery({
      azureLogAnalytics: { mode: LogsEditorMode.Raw, resources: [] },
    });
    delete query?.subscription;
    const onChange = jest.fn();
    const onQueryChange = jest.fn();
    const basicLogsEnabled = false;

    render(
      <LogsQueryEditor
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        onQueryChange={onQueryChange}
        setError={() => {}}
        basicLogsEnabled={basicLogsEnabled}
      />
    );

    const resourcePickerButton = await screen.findByRole('button', { name: 'Select a resource' });
    await userEvent.click(resourcePickerButton);

    const subscriptionButton = await screen.findByRole('button', { name: 'Expand Primary Subscription' });
    await userEvent.click(subscriptionButton);

    const resourceGroupButton = await screen.findByRole('button', { name: 'Expand A Great Resource Group' });
    await userEvent.click(resourceGroupButton);

    const checkbox = await screen.findByLabelText('web-server');
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    const checkbox2 = await screen.findByLabelText('db-server');
    await userEvent.click(checkbox2);
    expect(checkbox2).toBeChecked();

    await userEvent.click(await screen.findByRole('button', { name: 'Apply' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        azureLogAnalytics: expect.objectContaining({
          resources: [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/virtualMachines/web-server',
            '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/virtualMachines/db-server',
          ],
        }),
      })
    );
  });

  it('should disable other resource types when selecting multiple resources', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery({
      azureLogAnalytics: { mode: LogsEditorMode.Raw, resources: [] },
    });
    delete query?.subscription;
    const basicLogsEnabled = false;
    const onChange = jest.fn();
    const onQueryChange = jest.fn();

    render(
      <LogsQueryEditor
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        onQueryChange={onQueryChange}
        setError={() => {}}
        basicLogsEnabled={basicLogsEnabled}
      />
    );

    const resourcePickerButton = await screen.findByRole('button', { name: 'Select a resource' });
    await userEvent.click(resourcePickerButton);

    const subscriptionButton = await screen.findByRole('button', { name: 'Expand Primary Subscription' });
    await userEvent.click(subscriptionButton);

    const resourceGroupButton = await screen.findByRole('button', { name: 'Expand A Great Resource Group' });
    await userEvent.click(resourceGroupButton);

    const checkbox = await screen.findByLabelText('web-server');
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    expect(await screen.findByLabelText('web-server_DataDisk')).toBeDisabled();
  });

  it('should show info about multiple selection', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery({
      azureLogAnalytics: { mode: LogsEditorMode.Raw, resources: [] },
    });
    delete query?.subscription;
    const basicLogsEnabled = false;
    const onChange = jest.fn();
    const onQueryChange = jest.fn();

    render(
      <LogsQueryEditor
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        onQueryChange={onQueryChange}
        setError={() => {}}
        basicLogsEnabled={basicLogsEnabled}
      />
    );

    const resourcePickerButton = await screen.findByRole('button', { name: 'Select a resource' });
    await userEvent.click(resourcePickerButton);

    const subscriptionButton = await screen.findByRole('button', { name: 'Expand Primary Subscription' });
    await userEvent.click(subscriptionButton);

    const resourceGroupButton = await screen.findByRole('button', { name: 'Expand A Great Resource Group' });
    await userEvent.click(resourceGroupButton);

    const checkbox = await screen.findByLabelText('web-server');
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    expect(await screen.findByText('You may only choose items of the same resource type.')).toBeInTheDocument();
  });

  it('should call onApply with a new subscription uri when a user types it in the selection box', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery({
      azureLogAnalytics: { mode: LogsEditorMode.Raw, resources: [] },
    });
    delete query?.subscription;
    const basicLogsEnabled = false;
    const onChange = jest.fn();
    const onQueryChange = jest.fn();

    render(
      <LogsQueryEditor
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        onQueryChange={onQueryChange}
        setError={() => {}}
        basicLogsEnabled={basicLogsEnabled}
      />
    );

    const resourcePickerButton = await screen.findByRole('button', { name: 'Select a resource' });
    await userEvent.click(resourcePickerButton);

    const advancedSection = screen.getByText('Advanced');
    await userEvent.click(advancedSection);

    const advancedInput = await screen.findByTestId('input-advanced-resource-picker-1');

    await userEvent.type(advancedInput, '/subscriptions/def-123');

    const applyButton = screen.getByRole('button', { name: 'Apply' });
    await userEvent.click(applyButton);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        azureLogAnalytics: expect.objectContaining({
          resources: ['/subscriptions/def-123'],
        }),
      })
    );
  });

  it('should update the dashboardTime prop', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery();
    const basicLogsEnabled = false;
    const onChange = jest.fn();
    const onQueryChange = jest.fn();

    render(
      <LogsQueryEditor
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        onQueryChange={onQueryChange}
        setError={() => {}}
        basicLogsEnabled={basicLogsEnabled}
      />
    );

    const dashboardTimeOption = await screen.findByLabelText('Dashboard');
    await userEvent.click(dashboardTimeOption);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        azureLogAnalytics: expect.objectContaining({
          dashboardTime: true,
        }),
      })
    );
  });

  describe('azure portal link', () => {
    it('should show the link button', async () => {
      const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
      const query = createMockQuery();
      const basicLogsEnabled = false;
      const onChange = jest.fn();
      const onQueryChange = jest.fn();

      const date = dateTime(new Date());
      render(
        <LogsQueryEditor
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={onChange}
          onQueryChange={onQueryChange}
          setError={() => {}}
          basicLogsEnabled={basicLogsEnabled}
          data={{
            state: LoadingState.Done,
            timeRange: {
              from: date,
              to: date,
              raw: {
                from: date,
                to: date,
              },
            },
            series: [{ refId: query.refId, length: 0, meta: { custom: { azurePortalLink: 'test' } }, fields: [] }],
          }}
        />
      );

      expect(await screen.findByText('View query in Azure Portal')).toBeInTheDocument();
    });
  });

  describe('basic logs toggle', () => {
    it('should show basic logs toggle', async () => {
      const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
          ],
        },
      });
      const basicLogsEnabled = true;
      const onChange = jest.fn();
      const onQueryChange = jest.fn();

      await act(async () => {
        render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={basicLogsEnabled}
          />
        );
      });

      expect(await screen.findByLabelText('Basic')).toBeInTheDocument();
    });

    it('should show basic logs toggle for workspace variables', async () => {
      const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
      const query = createMockQuery({
        azureLogAnalytics: {
          resources: ['$ws'],
        },
      });
      const basicLogsEnabled = true;
      const onChange = jest.fn();
      const onQueryChange = jest.fn();

      await act(async () => {
        render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={basicLogsEnabled}
          />
        );
      });

      expect(await screen.findByLabelText('Basic')).toBeInTheDocument();
    });

    it('should not show basic logs toggle - basic logs not enabled', async () => {
      const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
          ],
        },
      });
      const basicLogsEnabled = false;
      const onChange = jest.fn();
      const onQueryChange = jest.fn();

      await act(async () => {
        render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={basicLogsEnabled}
          />
        );
      });

      expect(await screen.queryByLabelText('Basic')).not.toBeInTheDocument();
    });

    it('should not show basic logs toggle for non workspace variables', async () => {
      const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
      const query = createMockQuery({
        azureLogAnalytics: {
          resources: ['$non_ws_var'],
        },
      });
      const basicLogsEnabled = true;
      const onChange = jest.fn();
      const onQueryChange = jest.fn();

      await act(async () => {
        render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={basicLogsEnabled}
          />
        );
      });

      expect(await screen.queryByLabelText('Basic')).not.toBeInTheDocument();
    });

    it('should not show basic logs toggle - selected resource is not LA workspace', async () => {
      const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/virtualMachines/web-server',
          ],
        },
      });
      const basicLogsEnabled = true;
      const onChange = jest.fn();
      const onQueryChange = jest.fn();

      await act(async () => {
        render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={basicLogsEnabled}
          />
        );
      });

      expect(await screen.queryByLabelText('Basic')).not.toBeInTheDocument();
    });

    it('should disable other resources with a basic logs query when one resource is selected', async () => {
      const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
          ],
          basicLogsQuery: true,
        },
      });
      const basicLogsEnabled = true;
      const onChange = jest.fn();
      const onQueryChange = jest.fn();

      render(
        <LogsQueryEditor
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={onChange}
          onQueryChange={onQueryChange}
          setError={() => {}}
          basicLogsEnabled={basicLogsEnabled}
        />
      );

      expect(await screen.findByLabelText('Basic')).toBeInTheDocument();

      const resourcePickerButton = await screen.findByRole('button', { name: 'la-workspace' });
      await userEvent.click(resourcePickerButton);

      const checkbox = await screen.queryAllByLabelText('la-workspace');
      expect(checkbox[0]).toBeChecked();

      expect(await screen.findByLabelText('la-workspace-1')).toBeDisabled();
      expect(
        await screen.findByText('When using Basic Logs, you may only select one resource at a time.')
      ).toBeInTheDocument();
    });

    it('should preserve a legacy Basic query when Basic Logs are enabled', async () => {
      const mockDatasource = createMockDatasource();
      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
          ],
          basicLogsQuery: true,
          logTier: undefined,
          query: 'BasicTable | take 10',
        },
      });
      const onChange = jest.fn();

      render(
        <LogsQueryEditor
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={onChange}
          onQueryChange={jest.fn()}
          setError={() => {}}
          basicLogsEnabled={true}
          auxiliaryLogsEnabled={false}
        />
      );

      await waitFor(() => expect(screen.getByLabelText('Basic')).toBeChecked());
      expect(onChange).not.toHaveBeenCalledWith(
        expect.objectContaining({
          azureLogAnalytics: expect.objectContaining({ basicLogsQuery: false }),
        })
      );
    });

    it('should clear a legacy Basic query rather than convert it when only Auxiliary Logs are enabled', async () => {
      const mockDatasource = createMockDatasource();
      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
          ],
          basicLogsQuery: true,
          logTier: undefined,
          query: 'BasicTable | take 10',
          builderQuery: {
            from: {
              type: BuilderQueryEditorExpressionType.Property,
              property: { type: BuilderQueryEditorPropertyType.String, name: 'BasicTable' },
            },
          },
        },
      });
      const onChange = jest.fn();

      render(
        <LogsQueryEditor
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={onChange}
          onQueryChange={jest.fn()}
          setError={() => {}}
          basicLogsEnabled={false}
          auxiliaryLogsEnabled={true}
        />
      );

      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({
            azureLogAnalytics: expect.objectContaining({
              basicLogsQuery: false,
              logTier: undefined,
              query: '',
              builderQuery: expect.objectContaining({
                from: expect.objectContaining({ property: expect.objectContaining({ name: '' }) }),
              }),
            }),
          })
        )
      );
      expect(onChange).not.toHaveBeenCalledWith(
        expect.objectContaining({
          azureLogAnalytics: expect.objectContaining({ logTier: 'Auxiliary' }),
        })
      );
    });
  });

  describe('data ingestion warning', () => {
    it('should show generic data ingested warning when running basic logs queries', async () => {
      const mockDatasource = createMockDatasource();
      const onChange = jest.fn();
      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
          ],
          basicLogsQuery: true,
        },
      });
      const onQueryChange = jest.fn();

      mockDatasource.azureLogAnalyticsDatasource.getLogsQueryUsage.mockResolvedValue(0);
      await act(async () => {
        render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={true}
          />
        );
      });

      await act(async () => {
        await waitFor(() =>
          expect(
            screen.findByText(/This is a Basic Logs query — uses the search endpoint and incurs cost per GiB scanned\./)
          ).resolves.toBeInTheDocument()
        );
      });
    });

    it('shows the Auxiliary warning and documentation link when usage is nonzero', async () => {
      const mockDatasource = createMockDatasource();
      const onChange = jest.fn();
      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
          ],
          basicLogsQuery: true,
          logTier: 'Auxiliary',
        },
      });
      const onQueryChange = jest.fn();

      mockDatasource.azureLogAnalyticsDatasource.getLogsQueryUsage.mockResolvedValue(0.45);
      render(
        <LogsQueryEditor
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={onChange}
          onQueryChange={onQueryChange}
          setError={() => {}}
          basicLogsEnabled={false}
          auxiliaryLogsEnabled={true}
        />
      );

      expect(
        await screen.findByText(
          "This Auxiliary Logs query is processing 0.45 GiB when run. Auxiliary Logs have no response-time SLA and aren't suitable for real-time or alerting scenarios."
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Learn More' })).toHaveAttribute(
        'href',
        'https://learn.microsoft.com/en-us/azure/azure-monitor/logs/data-platform-logs#table-plans'
      );
    });

    it('should show data ingested warning when running basic logs queries', async () => {
      const mockDatasource = createMockDatasource();
      const onChange = jest.fn();
      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
          ],
          basicLogsQuery: true,
        },
      });
      const onQueryChange = jest.fn();

      mockDatasource.azureLogAnalyticsDatasource.getLogsQueryUsage.mockResolvedValue(0.45);
      await act(async () => {
        render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={true}
          />
        );
      });

      await act(async () => {
        await waitFor(() =>
          expect(screen.findByText(/This query is processing 0.45 GiB when run./)).resolves.toBeInTheDocument()
        );
      });
      expect(screen.getByRole('link', { name: 'Learn More' })).toHaveAttribute(
        'href',
        'https://learn.microsoft.com/en-us/azure/azure-monitor/logs/basic-logs-configure?tabs=portal-1'
      );
    });

    it('should not show data ingested warning when running basic logs queries', async () => {
      const mockDatasource = createMockDatasource();
      const onChange = jest.fn();
      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
          ],
          basicLogsQuery: true,
          query: '',
        },
      });
      const onQueryChange = jest.fn();

      mockDatasource.azureLogAnalyticsDatasource.getLogsQueryUsage.mockResolvedValue(0.5);
      await act(async () => {
        render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={true}
          />
        );
      });

      expect(await screen.queryByLabelText(/This query is processing 0.50 GiB when run./)).not.toBeInTheDocument();
    });
  });

  describe('format as options', () => {
    it('sets to time series if there is a query with empty result format', async () => {
      const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
      const query = createMockQuery({
        azureLogAnalytics: {
          resultFormat: undefined,
        },
      });
      const onChange = jest.fn();
      const onQueryChange = jest.fn();

      await act(async () => {
        render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={false}
          />
        );
      });
      const newQuery = {
        ...query,
        azureLogAnalytics: { ...query.azureLogAnalytics, resultFormat: ResultFormat.TimeSeries },
      };
      expect(onChange).toHaveBeenCalledWith(newQuery);
    });
    it('sets to logs if the query is new', async () => {
      const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
      const query = { ...createMockQuery(), azureLogAnalytics: undefined };
      const onChange = jest.fn();
      const onQueryChange = jest.fn();

      await act(async () => {
        render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={false}
          />
        );
      });
      const newQuery = {
        ...query,
        azureLogAnalytics: { resultFormat: ResultFormat.Logs },
      };
      expect(onChange).toHaveBeenCalledWith(newQuery);
    });
  });

  describe('schema loading and auto-completion', () => {
    let originalToggle: boolean | undefined;

    beforeEach(() => {
      originalToggle = config.featureToggles.azureMonitorLogsBuilderEditor;
      config.featureToggles.azureMonitorLogsBuilderEditor = true;
    });

    afterEach(() => {
      config.featureToggles.azureMonitorLogsBuilderEditor = originalToggle;
    });

    it('keeps Raw schema unavailable in Builder until table plans finish loading', async () => {
      const table = {
        columns: [{ name: 'TimeGenerated', type: 'datetime' }],
        id: 'AuxiliaryTable',
        name: 'AuxiliaryTable',
        timespanColumn: 'TimeGenerated',
        related: { solutions: [], functions: [], categories: [] },
      };
      const database = {
        name: 'la-workspace',
        tables: [table],
        functions: [],
        majorVersion: 0,
        minorVersion: 0,
        entityGroups: [],
        graphs: [],
      };
      const mockSchema: EngineSchema = {
        clusterType: 'Engine',
        cluster: {
          connectionString: 'la-workspace',
          databases: [database],
        },
        database,
      };
      let resolvePlan: (plan: TablePlan) => void = () => {};
      const planPromise = new Promise<TablePlan>((resolve) => {
        resolvePlan = resolve;
      });
      let resolveRawSchema: (schema: EngineSchema) => void = () => {};
      const rawSchemaPromise = new Promise<EngineSchema>((resolve) => {
        resolveRawSchema = resolve;
      });
      const mockDatasource = createMockDatasource();
      mockDatasource.azureLogAnalyticsDatasource.getKustoSchema = jest
        .fn()
        .mockReturnValueOnce(rawSchemaPromise)
        .mockResolvedValue(mockSchema);
      // @ts-ignore: forcibly attach for test
      mockDatasource.azureMonitorDatasource.getWorkspaceTablePlan = jest.fn().mockReturnValue(planPromise);
      const resources = [
        '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
      ];
      const rawQuery = createMockQuery({
        azureLogAnalytics: {
          resources,
          mode: LogsEditorMode.Raw,
        },
      });
      const builderQuery = createMockQuery({
        azureLogAnalytics: {
          resources,
          mode: LogsEditorMode.Builder,
        },
      });
      const onQueryChange = jest.fn();

      const { rerender } = render(
        <LogsQueryEditor
          query={rawQuery}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={jest.fn()}
          onQueryChange={onQueryChange}
          setError={jest.fn()}
          basicLogsEnabled={true}
          auxiliaryLogsEnabled={true}
        />
      );

      await waitFor(() => expect(mockDatasource.azureLogAnalyticsDatasource.getKustoSchema).toHaveBeenCalledTimes(1));
      await act(async () => resolveRawSchema(mockSchema));
      onQueryChange.mockClear();

      rerender(
        <LogsQueryEditor
          query={builderQuery}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={jest.fn()}
          onQueryChange={onQueryChange}
          setError={jest.fn()}
          basicLogsEnabled={true}
          auxiliaryLogsEnabled={true}
        />
      );

      await waitFor(() => expect(mockDatasource.azureMonitorDatasource.getWorkspaceTablePlan).toHaveBeenCalledTimes(1));
      const tableSelect = screen.getByLabelText('Table');
      await userEvent.click(tableSelect);
      expect(screen.queryByText('AuxiliaryTable')).not.toBeInTheDocument();
      expect(onQueryChange).not.toHaveBeenCalled();

      resolvePlan(TablePlan.Auxiliary);

      await selectOptionInTest(tableSelect, 'AuxiliaryTable');
      expect(onQueryChange).toHaveBeenCalledWith(
        expect.objectContaining({
          azureLogAnalytics: expect.objectContaining({
            basicLogsQuery: true,
            logTier: 'Auxiliary',
            builderQuery: expect.objectContaining({
              from: expect.objectContaining({
                property: expect.objectContaining({ name: 'AuxiliaryTable' }),
              }),
            }),
          }),
        })
      );
    });

    it('loads schema and table plans when resources change and builder mode is set', async () => {
      const mockSchema: EngineSchema = {
        clusterType: 'Engine',
        cluster: {
          connectionString:
            '/subscriptions/subscriptionId/resourceGroups/resourceGroup/providers/Microsoft.OperationalInsights/workspaces/la-workspace',
          databases: [
            {
              name: '/subscriptions/subscriptionId/resourceGroups/resourceGroup/providers/Microsoft.OperationalInsights/workspaces/la-workspace',
              tables: [
                {
                  columns: [
                    {
                      description: '',
                      isPreferredFacet: false,
                      name: 'TenantId',
                      type: 'string',
                    },
                    {
                      description: 'Date and time when dependency call was recorded.',
                      isPreferredFacet: false,
                      name: 'TimeGenerated',
                      type: 'datetime',
                    },
                  ],
                  description: 'Application Insights dependencies.',
                  id: 'AppDependencies',
                  name: 'AppDependencies',
                  timespanColumn: 'TimeGenerated',
                  hasData: true,
                  related: {
                    solutions: [],
                    functions: [],
                    categories: [],
                  },
                },
              ],
              functions: [],
              majorVersion: 0,
              minorVersion: 0,
              entityGroups: [],
              graphs: [],
            },
          ],
        },
        database: {
          name: '/subscriptions/subscriptionId/resourceGroups/resourceGroup/providers/Microsoft.OperationalInsights/workspaces/la-workspace',
          tables: [
            {
              columns: [
                {
                  description: '',
                  isPreferredFacet: false,
                  name: 'TenantId',
                  type: 'string',
                },
                {
                  description: 'Date and time when dependency call was recorded.',
                  isPreferredFacet: false,
                  name: 'TimeGenerated',
                  type: 'datetime',
                },
              ],
              description: 'Application Insights dependencies.',
              id: 'AppDependencies',
              name: 'AppDependencies',
              timespanColumn: 'TimeGenerated',
              hasData: true,
              related: {
                solutions: [],
                functions: [],
                categories: [],
              },
            },
          ],
          functions: [],
          majorVersion: 0,
          minorVersion: 0,
          entityGroups: [],
          graphs: [],
        },
      };
      const mockDatasource = createMockDatasource();
      mockDatasource.azureLogAnalyticsDatasource.getKustoSchema = jest.fn().mockResolvedValue(mockSchema);
      // @ts-ignore: forcibly attach for test
      mockDatasource.azureMonitorDatasource.getWorkspaceTablePlan = jest.fn().mockResolvedValue(TablePlan.Basic);
      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
          ],
          mode: require('../../dataquery.gen').LogsEditorMode.Builder,
        },
      });
      const onChange = jest.fn();
      const onQueryChange = jest.fn();

      await act(async () => {
        render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={true}
          />
        );
      });

      await waitFor(() => {
        expect(mockDatasource.azureLogAnalyticsDatasource.getKustoSchema).toHaveBeenCalledWith(
          query.azureLogAnalytics?.resources?.[0]
        );
      });
      expect(mockDatasource.azureMonitorDatasource.getWorkspaceTablePlan).toHaveBeenCalledTimes(1);
      expect(mockDatasource.azureMonitorDatasource.getWorkspaceTablePlan).toHaveBeenCalledWith(
        query.azureLogAnalytics?.resources,
        'AppDependencies'
      );

      await selectOptionInTest(await screen.findByLabelText('Table'), 'AppDependencies');
      expect(onQueryChange).toHaveBeenCalledWith(
        expect.objectContaining({
          azureLogAnalytics: expect.objectContaining({
            basicLogsQuery: true,
            logTier: 'Basic',
          }),
        })
      );
    });

    it('keeps successful table plans and disables a table when its plan request fails', async () => {
      const tables = [
        {
          columns: [],
          id: 'UnavailablePlanTable',
          name: 'UnavailablePlanTable',
          timespanColumn: 'TimeGenerated',
          related: { solutions: [] },
        },
        {
          columns: [],
          id: 'BasicTable',
          name: 'BasicTable',
          timespanColumn: 'TimeGenerated',
          related: { solutions: [] },
        },
      ];
      const database = {
        name: 'la-workspace',
        tables,
        functions: [],
        majorVersion: 0,
        minorVersion: 0,
        entityGroups: [],
        graphs: [],
      };
      const mockSchema: EngineSchema = {
        clusterType: 'Engine',
        cluster: {
          connectionString: 'la-workspace',
          databases: [database],
        },
        database,
      };
      const mockDatasource = createMockDatasource();
      mockDatasource.azureLogAnalyticsDatasource.getKustoSchema = jest.fn().mockResolvedValue(mockSchema);
      // @ts-ignore: forcibly attach for test
      mockDatasource.azureMonitorDatasource.getWorkspaceTablePlan = jest.fn((_resources, tableName: string) => {
        return tableName === 'UnavailablePlanTable'
          ? Promise.reject(new Error('table plan request failed'))
          : Promise.resolve(TablePlan.Basic);
      });
      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
          ],
          mode: require('../../dataquery.gen').LogsEditorMode.Builder,
        },
      });
      const onQueryChange = jest.fn();

      render(
        <LogsQueryEditor
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={jest.fn()}
          onQueryChange={onQueryChange}
          setError={jest.fn()}
          basicLogsEnabled={true}
        />
      );

      const tableSelect = await screen.findByLabelText('Table');
      await selectOptionInTest(tableSelect, 'UnavailablePlanTable').catch(() => {});
      expect(
        screen.getByText('This table cannot be selected because its Logs plan could not be determined.')
      ).toBeInTheDocument();
      expect(onQueryChange).not.toHaveBeenCalled();

      await selectOptionInTest(tableSelect, 'BasicTable');
      expect(onQueryChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          azureLogAnalytics: expect.objectContaining({
            basicLogsQuery: true,
            logTier: 'Basic',
          }),
        })
      );
    });
  });

  describe('tier auto-switch notification (Builder mode)', () => {
    const workspaceUri =
      '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace';
    let originalToggle: boolean | undefined;

    beforeEach(() => {
      originalToggle = config.featureToggles.azureMonitorLogsBuilderEditor;
      config.featureToggles.azureMonitorLogsBuilderEditor = true;
    });

    afterEach(() => {
      config.featureToggles.azureMonitorLogsBuilderEditor = originalToggle;
    });

    const buildSchemaWithPlans = (): EngineSchema => ({
      clusterType: 'Engine',
      cluster: {
        connectionString: workspaceUri,
        databases: [],
      },
      database: {
        name: workspaceUri,
        tables: [
          {
            id: 'AnalyticsTable',
            name: 'AnalyticsTable',
            timespanColumn: 'TimeGenerated',
            columns: [{ name: 'TimeGenerated', type: 'datetime' }],
            related: { solutions: [], functions: [], categories: [] },
            plan: TablePlan.Analytics,
          },
          {
            id: 'BasicTable',
            name: 'BasicTable',
            timespanColumn: 'TimeGenerated',
            columns: [{ name: 'TimeGenerated', type: 'datetime' }],
            related: { solutions: [], functions: [], categories: [] },
            plan: TablePlan.Basic,
          },
          {
            id: 'AuxiliaryTable',
            name: 'AuxiliaryTable',
            timespanColumn: 'TimeGenerated',
            columns: [{ name: 'TimeGenerated', type: 'datetime' }],
            related: { solutions: [], functions: [], categories: [] },
            plan: TablePlan.Auxiliary,
          },
        ],
        functions: [],
        majorVersion: 0,
        minorVersion: 0,
        entityGroups: [],
        graphs: [],
      },
    });

    it('renders an info Alert when picking a Basic-plan table from an Analytics query and reverts on click', async () => {
      const mockDatasource = createMockDatasource();
      mockDatasource.azureLogAnalyticsDatasource.getKustoSchema = jest.fn().mockResolvedValue(buildSchemaWithPlans());
      // getWorkspaceTablePlan is invoked by the existing fetchAllPlans effect but
      // the schema we provide already has `plan` set, so the in-place mutation is a no-op.
      // @ts-ignore: forcibly attach for test
      mockDatasource.azureMonitorDatasource.getWorkspaceTablePlan = jest.fn((_resources, name: string) =>
        Promise.resolve(name === 'BasicTable' ? TablePlan.Basic : TablePlan.Analytics)
      );

      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [workspaceUri],
          mode: require('../../dataquery.gen').LogsEditorMode.Builder,
        },
      });
      const onChange = jest.fn();
      const onQueryChange = jest.fn();
      let rerender!: ReturnType<typeof render>['rerender'];

      await act(async () => {
        ({ rerender } = render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={true}
          />
        ));
      });

      const tableSelect = await screen.findByLabelText('Table');
      await selectOptionInTest(tableSelect, 'BasicTable');

      const switchedQuery = await waitFor(() => {
        const switchedCall = onQueryChange.mock.calls.find((call) => call[0]?.azureLogAnalytics?.logTier === 'Basic');
        expect(switchedCall).toBeDefined();
        return switchedCall![0];
      });
      rerender(
        <LogsQueryEditor
          query={switchedQuery}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={onChange}
          onQueryChange={onQueryChange}
          setError={() => {}}
          basicLogsEnabled={true}
        />
      );

      // Alert appears with the new tier in the title and the table name in the body
      const alertTitle = await screen.findByText(/Query tier set to Basic/);
      expect(alertTitle).toBeInTheDocument();
      const alert = alertTitle.closest('[role="alert"]') ?? alertTitle.closest('[data-testid^="data-testid Alert"]');
      expect(alert).not.toBeNull();
      expect(alert!.textContent).toContain('BasicTable');

      // Revert button uses the previous tier name
      const revertButton = screen.getByRole('button', { name: /Revert to Analytics/ });
      await userEvent.click(revertButton);

      // onChange is invoked with basicLogsQuery cleared back to false (Analytics tier)
      await waitFor(() => {
        const revertedCall = onChange.mock.calls.find((call) => call[0]?.azureLogAnalytics?.basicLogsQuery === false);
        expect(revertedCall).toBeDefined();
        expect(revertedCall![0].azureLogAnalytics.logTier).toBeUndefined();
        expect(revertedCall![0].azureLogAnalytics.builderQuery.from.property.name).toBe('');
        expect(revertedCall![0].azureLogAnalytics.query).toBe('');
      });

      // Alert is dismissed after revert
      expect(screen.queryByText(/Query tier set to Basic/)).not.toBeInTheDocument();
    });

    it('clears the selected table and KQL when reverting from Auxiliary to Basic', async () => {
      const mockDatasource = createMockDatasource();
      mockDatasource.azureLogAnalyticsDatasource.getKustoSchema = jest.fn().mockResolvedValue(buildSchemaWithPlans());
      // @ts-ignore: forcibly attach for test
      mockDatasource.azureMonitorDatasource.getWorkspaceTablePlan = jest.fn((_resources, name: string) =>
        Promise.resolve(name === 'AuxiliaryTable' ? TablePlan.Auxiliary : TablePlan.Basic)
      );

      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [workspaceUri],
          mode: require('../../dataquery.gen').LogsEditorMode.Builder,
          basicLogsQuery: true,
          logTier: 'Basic',
        },
      });
      const onChange = jest.fn();
      const onQueryChange = jest.fn();
      let rerender!: ReturnType<typeof render>['rerender'];

      await act(async () => {
        ({ rerender } = render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={true}
            auxiliaryLogsEnabled={true}
          />
        ));
      });

      const tableSelect = await screen.findByLabelText('Table');
      await selectOptionInTest(tableSelect, 'AuxiliaryTable');

      const switchedQuery = await waitFor(() => {
        const switchedCall = onQueryChange.mock.calls.find(
          (call) => call[0]?.azureLogAnalytics?.logTier === 'Auxiliary'
        );
        expect(switchedCall).toBeDefined();
        return switchedCall![0];
      });
      rerender(
        <LogsQueryEditor
          query={switchedQuery}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={onChange}
          onQueryChange={onQueryChange}
          setError={() => {}}
          basicLogsEnabled={true}
          auxiliaryLogsEnabled={true}
        />
      );

      await userEvent.click(await screen.findByRole('button', { name: /Revert to Basic/ }));

      await waitFor(() => {
        const revertedCall = onChange.mock.calls.find(
          (call) =>
            call[0]?.azureLogAnalytics?.logTier === 'Basic' &&
            call[0]?.azureLogAnalytics?.builderQuery?.from?.property.name === ''
        );
        expect(revertedCall).toBeDefined();
        expect(revertedCall![0].azureLogAnalytics.query).toBe('');
      });
    });

    it('dismisses the auto-switch notice when the tier is changed manually', async () => {
      const mockDatasource = createMockDatasource();
      mockDatasource.azureLogAnalyticsDatasource.getKustoSchema = jest.fn().mockResolvedValue(buildSchemaWithPlans());
      // @ts-ignore: forcibly attach for test
      mockDatasource.azureMonitorDatasource.getWorkspaceTablePlan = jest.fn((_resources, name: string) =>
        Promise.resolve(name === 'BasicTable' ? TablePlan.Basic : TablePlan.Analytics)
      );

      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [workspaceUri],
          mode: require('../../dataquery.gen').LogsEditorMode.Builder,
        },
      });
      const onChange = jest.fn();
      const onQueryChange = jest.fn();
      let rerender!: ReturnType<typeof render>['rerender'];

      await act(async () => {
        ({ rerender } = render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={true}
          />
        ));
      });

      await selectOptionInTest(await screen.findByLabelText('Table'), 'BasicTable');

      const switchedQuery = await waitFor(() => {
        const switchedCall = onQueryChange.mock.calls.find((call) => call[0]?.azureLogAnalytics?.logTier === 'Basic');
        expect(switchedCall).toBeDefined();
        return switchedCall![0];
      });
      rerender(
        <LogsQueryEditor
          query={switchedQuery}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={onChange}
          onQueryChange={onQueryChange}
          setError={() => {}}
          basicLogsEnabled={true}
        />
      );

      expect(await screen.findByText(/Query tier set to Basic/)).toBeInTheDocument();
      await userEvent.click(await screen.findByLabelText('Analytics'));

      expect(screen.queryByText(/Query tier set to Basic/)).not.toBeInTheDocument();
    });

    it('dismisses the auto-switch notice when the workspace changes', async () => {
      const mockDatasource = createMockDatasource();
      mockDatasource.azureLogAnalyticsDatasource.getKustoSchema = jest.fn().mockResolvedValue(buildSchemaWithPlans());
      // @ts-ignore: forcibly attach for test
      mockDatasource.azureMonitorDatasource.getWorkspaceTablePlan = jest.fn((_resources, name: string) =>
        Promise.resolve(name === 'BasicTable' ? TablePlan.Basic : TablePlan.Analytics)
      );

      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [workspaceUri],
          mode: require('../../dataquery.gen').LogsEditorMode.Builder,
        },
      });
      const onChange = jest.fn();
      const onQueryChange = jest.fn();
      let rerender!: ReturnType<typeof render>['rerender'];

      await act(async () => {
        ({ rerender } = render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={true}
          />
        ));
      });

      await selectOptionInTest(await screen.findByLabelText('Table'), 'BasicTable');

      const switchedQuery = await waitFor(() => {
        const switchedCall = onQueryChange.mock.calls.find((call) => call[0]?.azureLogAnalytics?.logTier === 'Basic');
        expect(switchedCall).toBeDefined();
        return switchedCall![0];
      });
      rerender(
        <LogsQueryEditor
          query={switchedQuery}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={onChange}
          onQueryChange={onQueryChange}
          setError={() => {}}
          basicLogsEnabled={true}
        />
      );

      expect(await screen.findByText(/Query tier set to Basic/)).toBeInTheDocument();

      rerender(
        <LogsQueryEditor
          query={{
            ...switchedQuery,
            azureLogAnalytics: {
              ...switchedQuery.azureLogAnalytics,
              resources: [`${workspaceUri}-other`],
            },
          }}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={onChange}
          onQueryChange={onQueryChange}
          setError={() => {}}
          basicLogsEnabled={true}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Query tier set to Basic/)).not.toBeInTheDocument();
      });
    });

    it('dismisses the auto-switch notice when the selected tier is disabled', async () => {
      const mockDatasource = createMockDatasource();
      mockDatasource.azureLogAnalyticsDatasource.getKustoSchema = jest.fn().mockResolvedValue(buildSchemaWithPlans());
      // @ts-ignore: forcibly attach for test
      mockDatasource.azureMonitorDatasource.getWorkspaceTablePlan = jest.fn((_resources, name: string) =>
        Promise.resolve(name === 'BasicTable' ? TablePlan.Basic : TablePlan.Analytics)
      );

      const query = createMockQuery({
        azureLogAnalytics: {
          resources: [workspaceUri],
          mode: require('../../dataquery.gen').LogsEditorMode.Builder,
        },
      });
      const onChange = jest.fn();
      const onQueryChange = jest.fn();
      let rerender!: ReturnType<typeof render>['rerender'];

      await act(async () => {
        ({ rerender } = render(
          <LogsQueryEditor
            query={query}
            datasource={mockDatasource}
            variableOptionGroup={variableOptionGroup}
            onChange={onChange}
            onQueryChange={onQueryChange}
            setError={() => {}}
            basicLogsEnabled={true}
          />
        ));
      });

      await selectOptionInTest(await screen.findByLabelText('Table'), 'BasicTable');

      const switchedQuery = await waitFor(() => {
        const switchedCall = onQueryChange.mock.calls.find((call) => call[0]?.azureLogAnalytics?.logTier === 'Basic');
        expect(switchedCall).toBeDefined();
        return switchedCall![0];
      });
      rerender(
        <LogsQueryEditor
          query={switchedQuery}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={onChange}
          onQueryChange={onQueryChange}
          setError={() => {}}
          basicLogsEnabled={true}
        />
      );

      expect(await screen.findByText(/Query tier set to Basic/)).toBeInTheDocument();
      rerender(
        <LogsQueryEditor
          query={switchedQuery}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onChange={onChange}
          onQueryChange={onQueryChange}
          setError={() => {}}
          basicLogsEnabled={false}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Query tier set to Basic/)).not.toBeInTheDocument();
      });
    });
  });
});
