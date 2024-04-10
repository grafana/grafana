import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';

import { LogsManagement } from './LogsManagement';

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

describe('LogsQueryEditor.LogsManagement', () => {
  it('should render set Basic Logs to true if Basic is clicked', async () => {
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

    expect(onChange).toBeCalledWith(
      expect.objectContaining({
        azureLogAnalytics: expect.objectContaining({
          basicLogsQuery: true,
        }),
      })
    );
  });

  it('should render set Basic Logs to false if Analytics is clicked', async () => {
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
        }),
      })
    );
  });
});
