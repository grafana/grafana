import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import FakeSchemaData from '../../azure_log_analytics/mocks/schema';
import createMockDatasource from '../../mocks/datasource';
import createMockQuery from '../../mocks/query';

import { TimeManagement } from './TimeManagement';

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

describe('LogsQueryEditor.TimeManagement', () => {
  it('should render the column picker if Dashboard is chosen', async () => {
    const mockDatasource = createMockDatasource();
    const query = createMockQuery({ azureLogAnalytics: { timeColumn: undefined } });
    const onChange = jest.fn();

    const { rerender } = render(
      <TimeManagement
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={() => {}}
        schema={FakeSchemaData.getLogAnalyticsFakeEngineSchema()}
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

    rerender(
      <TimeManagement
        query={{ ...query, azureLogAnalytics: { ...query.azureLogAnalytics, dashboardTime: true } }}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={() => {}}
        schema={FakeSchemaData.getLogAnalyticsFakeEngineSchema()}
      />
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        azureLogAnalytics: expect.objectContaining({
          timeColumn: 'TimeGenerated',
        }),
      })
    );
  });

  it('should render the default value if no time columns exist', async () => {
    const mockDatasource = createMockDatasource();
    const query = createMockQuery();
    const onChange = jest.fn();

    render(
      <TimeManagement
        query={{
          ...query,
          azureLogAnalytics: { ...query.azureLogAnalytics, dashboardTime: true, timeColumn: undefined },
        }}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={() => {}}
        schema={FakeSchemaData.getLogAnalyticsFakeEngineSchema([
          {
            id: 't/Alert',
            name: 'Alert',
            timespanColumn: 'TimeGenerated',
            columns: [],
            related: {
              solutions: [],
            },
          },
        ])}
      />
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        azureLogAnalytics: expect.objectContaining({
          timeColumn: 'TimeGenerated',
        }),
      })
    );
  });

  it('should render the first time column if no default exists', async () => {
    const mockDatasource = createMockDatasource();
    const query = createMockQuery();
    const onChange = jest.fn();

    render(
      <TimeManagement
        query={{
          ...query,
          azureLogAnalytics: { ...query.azureLogAnalytics, dashboardTime: true, timeColumn: undefined },
        }}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={() => {}}
        schema={FakeSchemaData.getLogAnalyticsFakeEngineSchema([
          {
            id: 't/Alert',
            name: 'Alert',
            timespanColumn: '',
            columns: [{ name: 'Timespan', type: 'datetime' }],
            related: {
              solutions: [],
            },
          },
        ])}
      />
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        azureLogAnalytics: expect.objectContaining({
          timeColumn: 'Timespan',
        }),
      })
    );
  });

  it('should render the query time column if it exists', async () => {
    const mockDatasource = createMockDatasource();
    const query = createMockQuery();
    const onChange = jest.fn();

    render(
      <TimeManagement
        query={{
          ...query,
          azureLogAnalytics: { ...query.azureLogAnalytics, dashboardTime: true, timeColumn: 'TestTimeColumn' },
        }}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={() => {}}
        schema={FakeSchemaData.getLogAnalyticsFakeEngineSchema([
          {
            id: 't/Alert',
            name: 'Alert',
            timespanColumn: '',
            columns: [{ name: 'TestTimeColumn', type: 'datetime' }],
            related: {
              solutions: [],
            },
          },
        ])}
      />
    );

    expect(onChange).not.toBeCalled();
    expect(screen.getByText('Alert > TestTimeColumn')).toBeInTheDocument();
  });

  it('should set time to dashboard and query disabled if basic logs is selected', async () => {
    const mockDatasource = createMockDatasource();
    const query = createMockQuery({ azureLogAnalytics: { basicLogsQuery: true, dashboardTime: true } });
    const onChange = jest.fn();

    render(
      <TimeManagement
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={() => {}}
        schema={FakeSchemaData.getLogAnalyticsFakeEngineSchema()}
      />
    );

    expect(screen.getByLabelText('Query')).toBeDisabled();
    expect(screen.getByLabelText('Dashboard')).toBeChecked();
  });
});
