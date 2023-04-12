import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { of } from 'rxjs';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { ArrayVector, CoreApp } from '@grafana/data';

import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import { AzureQueryType } from '../../dataquery.gen';

import Filters from './Filters';

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};
const user = userEvent.setup();

describe(`Traces Filters`, () => {
  const mockDatasource = createMockDatasource();

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
    const onQueryChange = jest.fn();
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
                values: new ArrayVector(['{"appId":[{"appId":"test-app-id", "count":10}]}']),
                entities: {},
              },
            ],
            length: 1,
          },
        ],
        state: 'Done',
      })
    );
    mockQuery.azureTraces = {
      ...mockQuery.azureTraces,
      filters: undefined,
    };
    const onQueryChange = jest.fn();
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

    const addFilter = await screen.findByLabelText('Add');
    userEvent.click(addFilter);
    expect(onQueryChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Property')).toBeInTheDocument());
    const propertySelect = await screen.findByText('Property');
    selectOptionInTest(propertySelect, 'appId');
    await waitFor(() => expect(screen.getByText('appId')).toBeInTheDocument());

    const valueSelect = await screen.findByText('Value');
    await act(() => user.click(valueSelect));

    const query = `let appId = toscalar(union isfuzzy=true ${mockQuery.azureTraces.traceTypes?.join(',')}
  | where $__timeFilter(timestamp)
  | summarize count=count() by appId
  | summarize make_list(pack_all()));
  print properties = bag_pack("appId", appId);`;

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
              resources: mockQuery.azureTraces.resources,
              query,
            },
            queryType: AzureQueryType.LogAnalytics,
          },
        ],
      })
    );
    await waitFor(() => expect(screen.getByText('test-app-id - (10)')).toBeInTheDocument());
    selectOptionInTest(propertySelect, 'test-app-id - (10)');

    expect(screen.getByText('appId')).toBeInTheDocument();
    expect(screen.getByText('=')).toBeInTheDocument();
    expect(screen.getByText('test-app-id - (10)')).toBeInTheDocument();
  });
});
