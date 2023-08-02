import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserEvent } from '@testing-library/user-event/dist/types/setup/setup';
import React from 'react';
import { of } from 'rxjs';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { ArrayVector, CoreApp } from '@grafana/data';

import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import { AzureQueryType } from '../../dataquery.gen';
import Datasource from '../../datasource';
import { AzureMonitorQuery } from '../../types';

import Filters from './Filters';
import { setFilters } from './setQueryValue';

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};
let user: UserEvent;
let mockDatasource: Datasource;
const onQueryChange = jest.fn();

const addFilter = async (
  mockQuery: AzureMonitorQuery,
  filter: {
    property: string;
    operation: string;
    index: number;
    filters: Array<{
      count: number;
      value: string;
    }>;
  },
  rerender: (ui: React.ReactElement) => void
) => {
  const { property, operation, index } = filter;
  const resultVector = new ArrayVector([
    `{"${property}":[${filter.filters.map(({ count, value }) => `{"${property}":"${value}", "count":${count}}`)}]}`,
  ]);
  mockDatasource.azureLogAnalyticsDatasource.query = jest.fn().mockReturnValue(
    of({
      data: [
        {
          refId: 'A',
          meta: {
            typeVersion: [0, 0],
            custom: {
              azureColumnTypes: ['dynamic'],
            },
          },
          fields: [
            {
              name: 'properties',
              type: 'string',
              typeInfo: {
                frame: 'string',
                nullable: true,
              },
              config: {
                links: [
                  {
                    title: 'View in Azure Portal',
                    targetBlank: true,
                    url: 'https://portal.azure.com/#blade/Microsoft_OperationsManagementSuite_Workspace/AnalyticsBlade/initiator/AnalyticsShareLinkToQuery/isQueryEditorVisible/true/scope/%7B%22resources%22%3A%5B%7B%22resourceId%22%3A%22%2Fsubscriptions%2F44693801-6ee6-49de-9b2d-9106972f9572%2FresourceGroups%2Fcloud-datasources%2Fproviders%2Fmicrosoft.insights%2Fcomponents%2FAppInsightsTestData%22%7D%5D%7D/query/H4sIAAAAAAAA%2F3zPz0rDQBAG8HufYuglu2ChTQtqa3wIEQ+KhEk66tD9x86skuDDS+qthF7m8DG%2F+RhHCpiS4x6VY2hfKAvHAA1olB4dZlPCFLB8lHEcGs2FAL+RHXbsWIcnkuJUFgC%2F8PNFmeCtUvYkij5V7%2FDYwBGVpshU9brerta71aZ+3tztt%2FV+d%2F9aWcBwvFAPV9Ttvzo3SvEeM48EfSxBm%2FM0Frph7q0L4vFErWNRk7A%2FteicsdYeFgApc1BIOSbKyiTQQIef7bRmljOHlzdzdfbwFwAA%2F%2F8vPrTNXwEAAA==/isQueryBase64Compressed/true/timespanInIsoFormat/P1D',
                  },
                ],
              },
              values: resultVector,
              entities: {},
            },
          ],
          length: 1,
        },
      ],
      state: 'Done',
    })
  );

  const operationLabel = operation === 'eq' ? '=' : '!=';
  const addFilter = await screen.findByLabelText('Add');
  await act(() => {
    userEvent.click(addFilter);
    if (mockQuery.azureTraces?.filters && mockQuery.azureTraces.filters.length < 1) {
      expect(onQueryChange).not.toHaveBeenCalled();
    }
  });

  await waitFor(() => expect(screen.getByText('Property')).toBeInTheDocument());
  const propertySelect = await screen.findByText('Property');
  selectOptionInTest(propertySelect, property);
  await waitFor(() => expect(screen.getByText(property)).toBeInTheDocument());

  await waitFor(() => expect(screen.getByText('Property')).toBeInTheDocument());
  const operationSelect = await screen.getAllByText('=');
  selectOptionInTest(operationSelect[index], operationLabel);
  await waitFor(() => expect(screen.getByText(operationLabel)).toBeInTheDocument());

  const valueSelect = await screen.findByText('Value');
  await waitFor(() => user.click(valueSelect));

  const query = `let ${property} = toscalar(union isfuzzy=true ${mockQuery.azureTraces?.traceTypes?.join(',')}
  | where $__timeFilter(timestamp)
  | summarize count=count() by ${property}
  | summarize make_list(pack_all()));
  print properties = bag_pack("${property}", ${property});`;

  expect(mockDatasource.azureLogAnalyticsDatasource.query).toHaveBeenCalledWith(
    expect.objectContaining({
      requestId: 'azure-traces-properties-req',
      interval: '',
      intervalMs: 0,
      scopedVars: {},
      timezone: '',
      startTime: 0,
      app: CoreApp.Unknown,
      targets: [
        {
          ...mockQuery,
          azureLogAnalytics: {
            resources: mockQuery.azureTraces?.resources,
            query,
          },
          queryType: AzureQueryType.LogAnalytics,
        },
      ],
    })
  );

  const values = [];
  for (const currFilter of filter.filters) {
    const label = `${currFilter.value} - (${currFilter.count})`;
    await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument());
    selectOptionInTest(valueSelect, label);
    await waitFor(() => expect(screen.getByText(currFilter.value)).toBeInTheDocument());
    values.push(currFilter.value);
  }

  if (mockQuery.azureTraces?.filters && mockQuery.azureTraces.filters.length === 0) {
    expect(onQueryChange).not.toHaveBeenCalled();
  }

  const newQuery = setFilters(mockQuery, [
    ...(mockQuery.azureTraces?.filters ?? []),
    { property, operation, filters: values },
  ]);
  await waitFor(() => {
    userEvent.type(valueSelect, '{Escape}');
    expect(onQueryChange).toHaveBeenCalledWith(newQuery);
  });

  rerender(
    <Filters
      datasource={mockDatasource}
      onQueryChange={onQueryChange}
      query={newQuery}
      setError={jest.fn()}
      variableOptionGroup={variableOptionGroup}
    />
  );

  return newQuery;
};

describe(`Traces Filters`, () => {
  beforeEach(() => {
    mockDatasource = createMockDatasource();
    user = userEvent.setup();
  });

  it('should render a trace filter', async () => {
    let mockQuery = createMockQuery();
    mockQuery.azureTraces = {
      ...mockQuery.azureTraces,
      filters: [
        {
          filters: ['test-filter'],
          operation: 'eq',
          property: 'test-property',
        },
      ],
    };

    render(
      <Filters
        subscriptionId="123"
        query={mockQuery}
        onQueryChange={onQueryChange}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        setError={jest.fn()}
      />
    );

    expect(screen.getByText('test-property')).toBeInTheDocument();
    expect(screen.getByText('=')).toBeInTheDocument();
    expect(screen.getByText('test-filter')).toBeInTheDocument();
  });

  it('should add a trace filter', async () => {
    let mockQuery = createMockQuery({ azureTraces: { traceTypes: ['customEvents'] } });
    mockQuery.azureTraces = {
      ...mockQuery.azureTraces,
      filters: undefined,
    };

    const { rerender } = render(
      <Filters
        datasource={mockDatasource}
        onQueryChange={onQueryChange}
        query={mockQuery}
        setError={jest.fn()}
        variableOptionGroup={variableOptionGroup}
      />
    );

    await addFilter(
      mockQuery,
      { property: 'appId', filters: [{ count: 10, value: 'test-app-id' }], operation: 'eq', index: 0 },
      rerender
    );
  });

  it('should add multiple trace filters', async () => {
    let mockQuery = createMockQuery({ azureTraces: { traceTypes: ['customEvents'] } });
    mockQuery.azureTraces = {
      ...mockQuery.azureTraces,
      filters: undefined,
    };

    const { rerender } = render(
      <Filters
        datasource={mockDatasource}
        onQueryChange={onQueryChange}
        query={mockQuery}
        setError={jest.fn()}
        variableOptionGroup={variableOptionGroup}
      />
    );

    mockQuery = await addFilter(
      mockQuery,
      { property: 'appId', filters: [{ count: 10, value: 'test-app-id' }], operation: 'eq', index: 0 },
      rerender
    );
    mockQuery = await addFilter(
      mockQuery,
      { property: 'client_Browser', filters: [{ count: 100, value: 'test-client' }], operation: 'ne', index: 1 },
      rerender
    );
  });

  it('should delete a trace filter', async () => {
    let mockQuery = createMockQuery({ azureTraces: { traceTypes: ['customEvents'] } });
    mockQuery.azureTraces = {
      ...mockQuery.azureTraces,
      filters: undefined,
    };

    const { rerender } = render(
      <Filters
        datasource={mockDatasource}
        onQueryChange={onQueryChange}
        query={mockQuery}
        setError={jest.fn()}
        variableOptionGroup={variableOptionGroup}
      />
    );

    mockQuery = await addFilter(
      mockQuery,
      { property: 'appId', filters: [{ count: 10, value: 'test-app-id' }], operation: 'eq', index: 0 },
      rerender
    );
    mockQuery = await addFilter(
      mockQuery,
      { property: 'client_Browser', filters: [{ count: 100, value: 'test-client' }], operation: 'ne', index: 1 },
      rerender
    );

    const removeButtons = screen.getAllByLabelText('Remove');

    mockQuery = {
      ...mockQuery,
      azureTraces: {
        ...mockQuery.azureTraces,
        filters: mockQuery.azureTraces?.filters?.slice(0, 1),
      },
    };

    await act(async () => {
      await userEvent.click(removeButtons[1]);
    });
    rerender(
      <Filters
        datasource={mockDatasource}
        onQueryChange={onQueryChange}
        query={mockQuery}
        setError={jest.fn()}
        variableOptionGroup={variableOptionGroup}
      />
    );

    expect(screen.getByText('appId')).toBeInTheDocument();
    expect(screen.getByText('=')).toBeInTheDocument();
    expect(screen.getByText('test-app-id')).toBeInTheDocument();
    expect(screen.queryByText('client_Browser')).not.toBeInTheDocument();
    expect(screen.queryByText('!=')).not.toBeInTheDocument();
    expect(screen.queryByText('test-client')).not.toBeInTheDocument();
  });

  it('should add a trace filter and select multiple values', async () => {
    let mockQuery = createMockQuery({ azureTraces: { traceTypes: ['customEvents'] } });
    mockQuery.azureTraces = {
      ...mockQuery.azureTraces,
      filters: undefined,
    };

    const { rerender } = render(
      <Filters
        datasource={mockDatasource}
        onQueryChange={onQueryChange}
        query={mockQuery}
        setError={jest.fn()}
        variableOptionGroup={variableOptionGroup}
      />
    );

    await addFilter(
      mockQuery,
      {
        property: 'appId',
        filters: [
          { count: 10, value: 'test-app-id' },
          { count: 20, value: 'test-app-id-2' },
        ],
        operation: 'eq',
        index: 0,
      },
      rerender
    );
  });

  it('should remove a value from a trace filter with multiple values', async () => {
    let mockQuery = createMockQuery({ azureTraces: { traceTypes: ['customEvents'] } });
    mockQuery.azureTraces = {
      ...mockQuery.azureTraces,
      filters: undefined,
    };

    const { rerender } = render(
      <Filters
        datasource={mockDatasource}
        onQueryChange={onQueryChange}
        query={mockQuery}
        setError={jest.fn()}
        variableOptionGroup={variableOptionGroup}
      />
    );

    mockQuery = await addFilter(
      mockQuery,
      {
        property: 'appId',
        filters: [
          { count: 10, value: 'test-app-id' },
          { count: 20, value: 'test-app-id-2' },
        ],
        operation: 'eq',
        index: 0,
      },
      rerender
    );

    const currFilter = mockQuery.azureTraces?.filters![0]!;
    mockQuery = {
      ...mockQuery,
      azureTraces: {
        ...mockQuery.azureTraces,
        filters: [
          {
            ...currFilter,
            filters: currFilter.filters.slice(0, 1),
          },
        ],
      },
    };
    const removeLabel = screen.getByLabelText(`Remove test-app-id-2`);
    await act(async () => {
      await userEvent.click(removeLabel);
    });

    rerender(
      <Filters
        datasource={mockDatasource}
        onQueryChange={onQueryChange}
        query={mockQuery}
        setError={jest.fn()}
        variableOptionGroup={variableOptionGroup}
      />
    );

    expect(screen.getByText('appId')).toBeInTheDocument();
    expect(screen.getByText('=')).toBeInTheDocument();
    expect(screen.getByText('test-app-id')).toBeInTheDocument();
    expect(screen.queryByText('test-app-id-2')).not.toBeInTheDocument();
  });
});
