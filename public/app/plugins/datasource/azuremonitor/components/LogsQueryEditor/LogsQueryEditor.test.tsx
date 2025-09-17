import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTime, LoadingState } from '@grafana/data';

import { ResultFormat } from '../../dataquery.gen';
import createMockDatasource from '../../mocks/datasource';
import createMockQuery from '../../mocks/query';
import { EngineSchema } from '../../types/types';

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
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureLogAnalytics?.resources;
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
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureLogAnalytics?.resources;
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
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureLogAnalytics?.resources;
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
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureLogAnalytics?.resources;
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

      mockDatasource.azureLogAnalyticsDatasource.getBasicLogsQueryUsage.mockResolvedValue(0);
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
            screen.findByText(/This is a Basic Logs query and incurs cost per GiB scanned./)
          ).resolves.toBeInTheDocument()
        );
      });
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

      mockDatasource.azureLogAnalyticsDatasource.getBasicLogsQueryUsage.mockResolvedValue(0.45);
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

      mockDatasource.azureLogAnalyticsDatasource.getBasicLogsQueryUsage.mockResolvedValue(0.5);
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
        },
      };
      const mockDatasource = createMockDatasource();
      mockDatasource.azureLogAnalyticsDatasource.getKustoSchema = jest.fn().mockResolvedValue(mockSchema);
      // @ts-ignore: forcibly attach for test
      mockDatasource.azureMonitorDatasource.getWorkspaceTablePlan = jest.fn().mockResolvedValue('plan');
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
    });
  });
});
