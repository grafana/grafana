import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { select, openMenu } from 'react-select-event';

import * as ui from '@grafana/ui';

import createMockDatasource from '../../__mocks__/datasource';
import { AzureMonitorQuery, AzureQueryType } from '../../types';

import VariableEditor from './VariableEditor';

// Have to mock CodeEditor because it doesnt seem to work in tests???
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual<typeof ui>('@grafana/ui'),
  CodeEditor: function CodeEditor({ value, onSave }: { value: string; onSave: (newQuery: string) => void }) {
    return <input data-testid="mockeditor" value={value} onChange={(event) => onSave(event.target.value)} />;
  },
}));

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
    getResourceGroups: jest.fn().mockResolvedValue([{ text: 'rg', value: 'rg' }]),
    getMetricNamespaces: jest.fn().mockResolvedValue([{ text: 'foo/bar', value: 'foo/bar' }]),
    getResourceNames: jest.fn().mockResolvedValue([{ text: 'foobar', value: 'foobar' }]),
    getVariablesRaw: jest.fn().mockReturnValue([
      { label: 'query0', name: 'sub0' },
      { label: 'query1', name: 'rg', query: { queryType: AzureQueryType.ResourceGroupsQuery } },
    ]),
  }),
};

describe('VariableEditor:', () => {
  it('can view a legacy Grafana query function', async () => {
    const onChange = jest.fn();
    const legacyQuery = { ...defaultProps.query, queryType: AzureQueryType.GrafanaTemplateVariableFn };
    render(<VariableEditor {...defaultProps} onChange={onChange} query={legacyQuery} />);
    await waitFor(() => screen.getByLabelText('select query type'));
    expect(screen.getByLabelText('select query type')).toBeInTheDocument();
    screen.getByLabelText('select query type').click();
    await select(screen.getByLabelText('select query type'), 'Grafana Query Function', {
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
      await userEvent.type(screen.getByTestId('mockeditor'), '{backspace}');
      expect(onChange).toHaveBeenCalledWith({
        azureLogAnalytics: {
          query: 'test quer',
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
      expect(screen.queryByLabelText('Subscriptions')).toBeInTheDocument();
      expect(screen.queryByText('Resource Graph')).toBeInTheDocument();
      expect(screen.queryByLabelText('Select subscription')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Select query type')).not.toBeInTheDocument();
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
      screen.getByText(text).click();
      // Simulate onChange behavior
      const newQuery = onChange.mock.calls.at(-1)[0];
      rerender(<VariableEditor {...defaultProps} query={newQuery} onChange={onChange} />);
      await waitFor(() => expect(screen.getByText(text)).toBeInTheDocument());
    };

    it('should run the query if requesting subscriptions', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      await selectAndRerender('select query type', 'Subscriptions', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ queryType: AzureQueryType.SubscriptionsQuery, refId: 'A' })
      );
    });

    it('should run the query if requesting resource groups', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      await selectAndRerender('select query type', 'Resource Groups', onChange, rerender);
      await selectAndRerender('select subscription', 'Primary Subscription', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.ResourceGroupsQuery,
          subscription: 'sub',
          refId: 'A',
        })
      );
    });

    it('should show template variables as options ', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      await selectAndRerender('select query type', 'Resource Groups', onChange, rerender);
      // Select a subscription
      openMenu(screen.getByLabelText('select subscription'));
      await waitFor(() => expect(screen.getByText('Primary Subscription')).toBeInTheDocument());
      screen.getByText('Template Variables').click();
      // Simulate onChange behavior
      const lastQuery = onChange.mock.calls.at(-1)[0];
      rerender(<VariableEditor {...defaultProps} query={lastQuery} onChange={onChange} />);
      await waitFor(() => expect(screen.getByText('query0')).toBeInTheDocument());
      // Template variables of the same type than the current one should not appear
      expect(screen.queryByText('query1')).not.toBeInTheDocument();
    });

    it('should run the query if requesting namespaces', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      await selectAndRerender('select query type', 'Namespaces', onChange, rerender);
      await selectAndRerender('select subscription', 'Primary Subscription', onChange, rerender);
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
      await selectAndRerender('select query type', 'Resource Names', onChange, rerender);
      await selectAndRerender('select subscription', 'Primary Subscription', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.ResourceNamesQuery,
          subscription: 'sub',
          refId: 'A',
        })
      );
    });

    it('should run the query if requesting metric names', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      await selectAndRerender('select query type', 'Metric Names', onChange, rerender);
      await selectAndRerender('select subscription', 'Primary Subscription', onChange, rerender);
      await selectAndRerender('select resource group', 'rg', onChange, rerender);
      await selectAndRerender('select namespace', 'foo/bar', onChange, rerender);
      await selectAndRerender('select resource', 'foobar', onChange, rerender);
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

    it('should clean up related fields', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      // Select a new query type
      await selectAndRerender('select query type', 'Subscriptions', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.SubscriptionsQuery,
          subscription: undefined,
          resourceGroup: undefined,
          namespace: undefined,
          resource: undefined,
          refId: 'A',
        })
      );
    });

    it('should run the query if requesting workspaces', async () => {
      const onChange = jest.fn();
      const { rerender } = render(<VariableEditor {...defaultProps} onChange={onChange} />);
      // wait for initial load
      await waitFor(() => expect(screen.getByText('Logs')).toBeInTheDocument());
      await selectAndRerender('select query type', 'Workspaces', onChange, rerender);
      await selectAndRerender('select subscription', 'Primary Subscription', onChange, rerender);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: AzureQueryType.WorkspacesQuery,
          subscription: 'sub',
          refId: 'A',
        })
      );
    });
  });
});
