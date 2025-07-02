import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import createMockDatasource from '../../mocks/datasource';
import createMockQuery from '../../mocks/query';

import { LogsManagement } from './LogsManagement';

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

describe('LogsQueryEditor.LogsManagement', () => {
  it('should set Basic Logs to true if Basic is clicked and acknowledged', async () => {
    const mockDatasource = createMockDatasource();
    const query = createMockQuery({ azureLogAnalytics: { basicLogsQuery: undefined } });
    const onChange = jest.fn();

    render(
      <LogsManagement
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={() => {}}
      />
    );

    const logsManagementOption = await screen.findByLabelText('Basic');
    await userEvent.click(logsManagementOption);

    // ensures that modal shows
    expect(await screen.findByText('Basic Logs Queries')).toBeInTheDocument();
    const acknowledgedAction = await screen.findByText('Confirm');
    await userEvent.click(acknowledgedAction);

    expect(onChange).toBeCalledWith(
      expect.objectContaining({
        azureLogAnalytics: expect.objectContaining({
          basicLogsQuery: true,
          query: '',
          dashboardTime: true,
        }),
      })
    );
  });

  it('should set Basic Logs to false if Analytics is clicked', async () => {
    const mockDatasource = createMockDatasource();
    const query = createMockQuery({ azureLogAnalytics: { basicLogsQuery: true } });
    const onChange = jest.fn();

    render(
      <LogsManagement
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={() => {}}
      />
    );

    const logsManagementOption = await screen.findByLabelText('Analytics');
    await userEvent.click(logsManagementOption);

    expect(onChange).toBeCalledWith(
      expect.objectContaining({
        azureLogAnalytics: expect.objectContaining({
          basicLogsQuery: false,
          query: '',
        }),
      })
    );
  });

  it('should set Basic Logs to true if Basic is clicked and clear query', async () => {
    const mockDatasource = createMockDatasource();
    const query = createMockQuery({ azureLogAnalytics: { basicLogsQuery: undefined, query: 'table | my test query' } });
    const onChange = jest.fn();

    render(
      <LogsManagement
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={() => {}}
      />
    );

    const logsManagementOption = await screen.findByLabelText('Basic');
    await userEvent.click(logsManagementOption);
    const acknowledgedAction = await screen.findByText('Confirm');
    await userEvent.click(acknowledgedAction);

    expect(onChange).toBeCalledWith(
      expect.objectContaining({
        azureLogAnalytics: expect.objectContaining({
          basicLogsQuery: true,
          query: '',
          dashboardTime: true,
        }),
      })
    );
  });

  it('should handle modal acknowledgements - cancel', async () => {
    const mockDatasource = createMockDatasource();
    const query = createMockQuery({ azureLogAnalytics: { basicLogsQuery: undefined } });
    const onChange = jest.fn();

    render(
      <LogsManagement
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={() => {}}
      />
    );

    const logsManagementOption = await screen.findByLabelText('Basic');
    await userEvent.click(logsManagementOption);

    // ensures that modal shows
    expect(await screen.findByText('Basic Logs Queries')).toBeInTheDocument();

    const cancelAcknowledgement = await screen.findByText('Cancel');
    await userEvent.click(cancelAcknowledgement);

    //ensures that if cancel is clicked, Logs is set back to analytics
    expect(onChange).toBeCalledWith(
      expect.objectContaining({
        azureLogAnalytics: expect.objectContaining({
          basicLogsQuery: false,
        }),
      })
    );
  });
});
