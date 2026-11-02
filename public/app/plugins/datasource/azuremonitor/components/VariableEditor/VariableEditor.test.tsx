import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { select, openMenu } from 'react-select-event';

// eslint-disable-next-line no-restricted-imports
import type * as ui from '@grafana/ui';

import { AzureQueryType } from '../../dataquery.gen';
import createMockDatasource from '../../mocks/datasource';
import { type AzureMonitorQuery } from '../../types/query';

import VariableEditor from './VariableEditor';

// Have to mock CodeEditor because it doesnt seem to work in tests???
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual<typeof ui>('@grafana/ui'),
  CodeEditor: function CodeEditor({ value, onSave }: { value: string; onSave: (newQuery: string) => void }) {
    return <input data-testid="mockeditor" value={value} onChange={(event) => onSave(event.target.value)} />;
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

const getResourceGroups = jest.fn().mockResolvedValue([{ resourceGroupURI: 'rg', resourceGroupName: 'rg', count: 1 }]);
const getResourceNames = jest.fn().mockResolvedValue([
  {
    id: '/subscriptions/subID/resourceGroups/resourceGroup/providers/foobarProvider/foobarType/foobar',
    name: 'foobar',
    subscriptionId: 'subID',
    resourceGroup: 'resourceGroup',
    type: 'foobarProvider/foobarType',
    location: 'london',
  },
]);
const defaultProps = {
  query: {
    refId: 'A',
    queryType: AzureQueryType.LogAnalytics,
    azureLogAnalytics: {
      query: 'test query',
    },
    subscription: 'id',
  },
  onChange: jest.fn(),
  datasource: createMockDatasource({
    getSubscriptions: jest.fn().mockResolvedValue([{ text: 'Primary Subscription', value: 'sub' }]),
    getMetricNamespaces: jest
      .fn()
      .mockImplementation(
        async (_subscriptionId: string, _resourceGroup?: string, _resourceUri?: string, custom?: boolean) => {
          if (custom !== true) {
            return [{ text: 'foo/bar', value: 'foo/bar' }];
          }
          return [{ text: 'foo/custom', value: 'foo/custom' }];
        }
      ),
    getVariablesRaw: jest.fn().mockReturnValue([
      { label: 'query0', name: 'sub0' },
      { label: 'query1', name: 'rg', query: { queryType: AzureQueryType.ResourceGroupsQuery } },
    ]),
    azureResourceGraphDatasource: {
      getResourceGroups,
      getResourceNames,
    },
    getResourceGroups,
    getResourceNames,
  }),
};

describe('VariableEditor:', () => {
  it('can view a legacy Grafana query function', async () => {
    const onChange = jest.fn();
    const legacyQuery = { ...defaultProps.query, queryType: AzureQueryType.GrafanaTemplateVariableFn };
    render(<VariableEditor {...defaultProps} onChange={onChange} query={legacyQuery} />);
    await waitFor(() => screen.getByLabelText('Select query type'));
    expect(screen.getByLabelText('Select query type')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Select query type'));
    await select(screen.getByLabelText('Select query type'), 'Grafana Query Function', {
      container: document.body,
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
      })
    );
  });

  describe('log queries:', () => {
    it('should render', async () => {
      render(<VariableEditor {...defaultProps} />);
      await waitFor(() => screen.queryByTestId('mockeditor'));
      expect(screen.queryByText('Resource')).toBeInTheDocument();
      expect(screen.queryByTestId('mockeditor')).toBeInTheDocument();
    });

    it('should call on change if the query changes', async () => {
      const onChange = jest.fn();
      render(<VariableEditor {...defaultProps} onChange={onChange} />);
      await waitFor(() => screen.queryByTestId('mockeditor'));
      expect(screen.queryByTestId('mockeditor')).toBeInTheDocument();
      await userEvent.type(screen.getByTestId('mockeditor'), '2');
      expect(onChange).toHaveBeenCalledWith({
        azureLogAnalytics: {
          query: 'test query2',
        },
        queryType: 'Azure Log Analytics',
        refId: 'A',
        subscription: 'id',
      });
    });
  });

  describe('Azure Resource Graph queries:', () => {
    const ARGqueryProps = {
      ...defaultProps,
      query: {
        refId: 'A',
        queryType: AzureQueryType.AzureResourceGraph,
        azureResourceGraph: {
          query: 'Resources | distinct type',
          resultFormat: 'table',
        },
        subscriptions: ['sub'],
      },
    };

    it('should render', async () => {
      render(<VariableEditor {...ARGqueryProps} />);
      await waitFor(() => screen.queryByTestId('mockeditor'));
      await waitFor(() => screen.queryByLabelText('Subscriptions'));
      expect(screen.queryByLabelText('Select query type')).toBeInTheDocument();
      expect(screen.queryByText('Resource Graph')).toBeInTheDocument();
      expect(screen.queryByLabelText('Select subscription')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Select resource group')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Select namespace')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Select resource')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mockeditor')).toBeInTheDocument();
    });

    it('should call on change if the query changes', async () => {
      const onChange = jest.fn();
      render(<VariableEditor {...ARGqueryProps} onChange={onChange} />);
      await waitFor(() => screen.queryByTestId('mockeditor'));
      expect(screen.queryByTestId('mockeditor')).toBeInTheDocument();
      await userEvent.type(screen.getByTestId('mockeditor'), '{backspace}');
      expect(onChange).toHaveBeenCalledWith({
        ...ARGqueryProps.query,
        azureResourceGraph: {
          query: 'Resources | distinct typ',
          resultFormat: 'table',
        },
      });
    });
  });

  describe('grafana template variable fn queries:', () => {
    it('should render', async () => {
      const props = {
        ...defaultProps,
        query: {
          refId: 'A',
          queryType: AzureQueryType.GrafanaTemplateVariableFn,
          grafanaTemplateVariableFn: {
            rawQuery: 'test query',
            kind: 'SubscriptionsQuery',
          },
          subscription: 'id',
        } as AzureMonitorQuery,
      };
      render(<VariableEditor {...props} />);
      await waitFor(() => screen.queryByText('Grafana template variable function'));
      expect(screen.queryByText('Grafana template variable function')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('test query')).toBeInTheDocument();
    });

    it('should call on change if the query changes', async () => {
      const props = {
        ...defaultProps,
        query: {
          refId: 'A',
          queryType: AzureQueryType.GrafanaTemplateVariableFn,
          grafanaTemplateVariableFn: {
            rawQuery: 'Su',
            kind: 'UnknownQuery',
          },
          subscription: 'subscriptionId',
        } as AzureMonitorQuery,
      };
      render(<VariableEditor {...props} />);
      await waitFor(() => screen.queryByText('Grafana template variable function'));
      await userEvent.type(screen.getByDisplayValue('Su'), 'bscriptions()');
      expect(screen.getByDisplayValue('Subscriptions()')).toBeInTheDocument();
      screen.getByDisplayValue('Subscriptions()').blur();
      await waitFor(() => screen.queryByText('None'));
      expect(props.onChange).toHaveBeenCalledWith({
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          rawQuery: 'Subscriptions()',
          kind: 'SubscriptionsQuery',
        },
        subscription: 'subscriptionId',
      });
    });
  });

  describe('predefined queries:', () => {
    const selectAndRerender = async (
      label: string,
      text: string,
      onChange: jest.Mock,
      rerender: (ui: React.ReactElement) => void
    ) => {
      openMenu(screen.getByLabelText(label));
      await userEvent.click(screen.getByText(text));
      // Simulate onChange behavior
      const newQuery = onChange.mock.calls.at(-1)[0];
      rerender(<VariableEditor {...defaultProps} query={newQuery} onChange={onChange} />);
      await waitFor(() => expect(screen.getByText(text)).toBeInTheDocument());
    };

    it('should run the query if requesting subscriptions', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      await selectAndRerender('Select query type', 'Subscriptions', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ queryType: AzureQueryType.SubscriptionsQuery, refId: 'A' })
      );
    });

    it('should run the query if requesting resource groups', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      await selectAndRerender('Select query type', 'Resource Groups', onChange, rerender);
      await selectAndRerender('Select subscription', 'Primary Subscription', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.ResourceGroupsQuery,
          subscription: 'sub',
          refId: 'A',
        })
      );
    });

    it('should show template variables with their query syntax as options', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      await selectAndRerender('Select query type', 'Resource Groups', onChange, rerender);
      // Select a subscription
      openMenu(screen.getByLabelText('Select subscription'));
      await waitFor(() => expect(screen.getByText('Primary Subscription')).toBeInTheDocument());
      expect(screen.getByText('$sub0')).toBeInTheDocument();
      // Template variables of the same type than the current one should not appear
      expect(screen.queryByText('$rg')).not.toBeInTheDocument();
    });

    it('should run the query if requesting namespaces', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      await selectAndRerender('Select query type', 'Namespaces', onChange, rerender);
      await selectAndRerender('Select subscription', 'Primary Subscription', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.NamespacesQuery,
          subscription: 'sub',
          refId: 'A',
        })
      );
    });

    it('should run the query if requesting resource names', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      await selectAndRerender('Select query type', 'Resource Names', onChange, rerender);
      await selectAndRerender('Select subscription', 'Primary Subscription', onChange, rerender);
      await selectAndRerender('Select region', 'North Europe', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.ResourceNamesQuery,
          subscription: 'sub',
          region: 'northeurope',
          refId: 'A',
        })
      );
    });

    it('should run the query if requesting metric names', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      await selectAndRerender('Select query type', 'Metric Names', onChange, rerender);
      await selectAndRerender('Select subscription', 'Primary Subscription', onChange, rerender);
      await selectAndRerender('Select resource group', 'rg', onChange, rerender);
      await selectAndRerender('Select namespace', 'foo/bar', onChange, rerender);
      await selectAndRerender('Select resource', 'foobar', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.MetricNamesQuery,
          subscription: 'sub',
          resourceGroup: 'rg',
          namespace: 'foo/bar',
          resource: 'foobar',
          refId: 'A',
        })
      );
    });

    it('shows the dimensions query type and metric cascade fields', async () => {
      render(
        <VariableEditor
          {...defaultProps}
          query={{
            refId: 'A',
            queryType: AzureQueryType.DimensionsQuery,
            subscription: 'sub',
            resourceGroup: 'rg',
            namespace: 'foo/bar',
            resource: 'foobar',
          }}
        />
      );

      openMenu(screen.getByLabelText('Select query type'));
      expect((await screen.findAllByText('Dimensions')).length).toBeGreaterThan(0);
      expect(screen.getByLabelText('Select subscription')).toBeInTheDocument();
      expect(screen.getByLabelText('Select resource group')).toBeInTheDocument();
      expect(screen.getByLabelText('Select namespace')).toBeInTheDocument();
      expect(screen.getByLabelText('Select resource')).toBeInTheDocument();
      expect(screen.getByLabelText('Select custom namespace')).toBeInTheDocument();
      expect(screen.getByLabelText('Select metric name')).toBeInTheDocument();
      expect(screen.queryByLabelText('Select dimension name')).not.toBeInTheDocument();
    });

    it('shows the dimension values query type and required cascade fields', async () => {
      render(
        <VariableEditor
          {...defaultProps}
          query={{
            refId: 'A',
            queryType: AzureQueryType.DimensionValuesQuery,
            subscription: 'sub',
            resourceGroup: 'rg',
            namespace: 'foo/bar',
            resource: 'foobar',
          }}
        />
      );

      openMenu(screen.getByLabelText('Select query type'));
      expect((await screen.findAllByText('Dimension Values')).length).toBeGreaterThan(0);
      expect(screen.getByLabelText('Select subscription')).toBeInTheDocument();
      expect(screen.getByLabelText('Select resource group')).toBeInTheDocument();
      expect(screen.getByLabelText('Select namespace')).toBeInTheDocument();
      expect(screen.getByLabelText('Select resource')).toBeInTheDocument();
      expect(screen.getByLabelText('Select custom namespace')).toBeInTheDocument();
      expect(screen.getByLabelText('Select metric name')).toBeInTheDocument();
      expect(screen.getByLabelText('Select dimension name')).toBeInTheDocument();
    });

    it('loads metric and dimension options for a dimension values query', async () => {
      const datasource = createMockDatasource({
        getVariablesRaw: jest.fn().mockReturnValue([{ label: 'query0', name: 'var0' }]),
        getMetricNamespaces: jest.fn().mockResolvedValue([]),
        getMetricNames: jest.fn().mockResolvedValue([{ text: 'Requests', value: 'Requests' }]),
      });
      datasource.azureMonitorDatasource.getMetricMetadata = jest.fn().mockResolvedValue({
        primaryAggType: 'Count',
        supportedAggTypes: ['Count'],
        supportedTimeGrains: [],
        dimensions: [{ label: 'Cloud role', value: 'CloudRole' }],
      });
      render(
        <VariableEditor
          {...defaultProps}
          datasource={datasource}
          query={{
            refId: 'A',
            queryType: AzureQueryType.DimensionValuesQuery,
            subscription: 'sub',
            resourceGroup: 'rg',
            namespace: 'foo/bar',
            resource: 'foobar',
            customNamespace: 'custom/ns',
            metricName: 'Requests',
          }}
        />
      );

      openMenu(screen.getByLabelText('Select metric name'));
      expect((await screen.findAllByText('Requests')).length).toBeGreaterThan(0);
      expect(screen.getByText('$var0')).toBeInTheDocument();
      openMenu(screen.getByLabelText('Select dimension name'));
      expect(await screen.findByText('Cloud role')).toBeInTheDocument();
      expect(screen.getAllByText('$var0').length).toBeGreaterThan(0);
      expect(datasource.getMetricNames).toHaveBeenCalledWith('sub', 'rg', 'foo/bar', 'foobar', 'custom/ns');
      expect(datasource.azureMonitorDatasource.getMetricMetadata).toHaveBeenCalledWith({
        subscription: 'sub',
        resourceGroup: 'rg',
        metricNamespace: 'foo/bar',
        resourceName: 'foobar',
        customNamespace: 'custom/ns',
        metricName: 'Requests',
      });
    });

    it('clears metric and dimension when a parent selection changes', async () => {
      const onChange = jest.fn();
      render(
        <VariableEditor
          {...defaultProps}
          onChange={onChange}
          query={{
            refId: 'A',
            queryType: AzureQueryType.DimensionValuesQuery,
            subscription: 'old-sub',
            resourceGroup: 'rg',
            namespace: 'foo/bar',
            resource: 'foobar',
            metricName: 'Requests',
            dimension: 'CloudRole',
          }}
        />
      );

      openMenu(screen.getByLabelText('Select subscription'));
      await userEvent.click(await screen.findByText('Primary Subscription'));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription: 'sub',
          metricName: undefined,
          dimension: undefined,
        })
      );
    });

    it('clears region state when changing query type', async () => {
      const onChange = jest.fn();
      const { rerender } = render(
        <VariableEditor
          {...defaultProps}
          onChange={onChange}
          query={{
            refId: 'A',
            queryType: AzureQueryType.ResourceNamesQuery,
            subscription: 'sub',
            region: 'eastus',
          }}
        />
      );
      expect(await screen.findByLabelText('Select region')).toBeInTheDocument();

      openMenu(screen.getByLabelText('Select query type'));
      await userEvent.click(await screen.findByText('Dimension Values'));
      const changedQuery = onChange.mock.calls.at(-1)[0];
      rerender(<VariableEditor {...defaultProps} onChange={onChange} query={changedQuery} />);

      expect(changedQuery.region).toBeUndefined();
      await waitFor(() => expect(screen.queryByLabelText('Select region')).not.toBeInTheDocument());
    });

    it('should clean up related fields', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      // Select a new query type
      await selectAndRerender('Select query type', 'Subscriptions', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.SubscriptionsQuery,
          subscription: undefined,
          resourceGroup: undefined,
          namespace: undefined,
          resource: undefined,
          region: undefined,
          customNamespace: undefined,
          metricName: undefined,
          dimension: undefined,
          refId: 'A',
        })
      );
    });

    it('should run the query if requesting workspaces', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      await selectAndRerender('Select query type', 'Workspaces', onChange, rerender);
      await selectAndRerender('Select subscription', 'Primary Subscription', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.WorkspacesQuery,
          subscription: 'sub',
          refId: 'A',
        })
      );
    });

    it('should run the query if requesting regions', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      await selectAndRerender('Select query type', 'Regions', onChange, rerender);
      await selectAndRerender('Select subscription', 'Primary Subscription', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.LocationsQuery,
          subscription: 'sub',
          refId: 'A',
        })
      );
    });

    it('should run the query if requesting custom metric namespaces', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      await selectAndRerender('Select query type', 'Custom Namespaces', onChange, rerender);
      await selectAndRerender('Select subscription', 'Primary Subscription', onChange, rerender);
      await selectAndRerender('Select resource group', 'rg', onChange, rerender);
      await selectAndRerender('Select namespace', 'foo/bar', onChange, rerender);
      await selectAndRerender('Select resource', 'foobar', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.CustomNamespacesQuery,
          subscription: 'sub',
          resourceGroup: 'rg',
          namespace: 'foo/bar',
          resource: 'foobar',
          refId: 'A',
        })
      );
    });

    it('should run the query if requesting custom metrics for a resource', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      await selectAndRerender('Select query type', 'Custom Metric Names', onChange, rerender);
      await selectAndRerender('Select subscription', 'Primary Subscription', onChange, rerender);
      await selectAndRerender('Select resource group', 'rg', onChange, rerender);
      await selectAndRerender('Select namespace', 'foo/bar', onChange, rerender);
      await selectAndRerender('Select resource', 'foobar', onChange, rerender);
      await selectAndRerender('Select custom namespace', 'foo/custom', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.CustomMetricNamesQuery,
          subscription: 'sub',
          resourceGroup: 'rg',
          namespace: 'foo/bar',
          resource: 'foobar',
          refId: 'A',
          customNamespace: 'foo/custom',
        })
      );
    });
  });
});
