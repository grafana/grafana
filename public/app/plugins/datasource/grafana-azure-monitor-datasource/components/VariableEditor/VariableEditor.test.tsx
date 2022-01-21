import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import VariableEditor from './VariableEditor';
import userEvent from '@testing-library/user-event';
import createMockDatasource from '../../__mocks__/datasource';
import { AzureMonitorQuery, AzureQueryType } from '../../types';
import { select } from 'react-select-event';
import * as ui from '@grafana/ui';

// Have to mock CodeEditor because it doesnt seem to work in tests???
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual<typeof ui>('@grafana/ui'),
  CodeEditor: function CodeEditor({ value, onSave }: { value: string; onSave: (newQuery: string) => void }) {
    return <input data-testid="mockeditor" value={value} onChange={(event) => onSave(event.target.value)} />;
  },
}));

describe('VariableEditor:', () => {
  it('can select a query type', async () => {
    const onChange = jest.fn();

    const props = {
      query: {
        refId: 'A',
        queryType: AzureQueryType.LogAnalytics,
        azureLogAnalytics: {
          query: 'test query',
        },
        subscription: 'id',
      },
      onChange,
      datasource: createMockDatasource(),
    };
    render(<VariableEditor {...props} />);
    await waitFor(() => screen.getByLabelText('select query type'));
    expect(screen.getByLabelText('select query type')).toBeInTheDocument();
    screen.getByLabelText('select query type').click();
    await select(screen.getByLabelText('select query type'), 'Grafana Query Function', {
      container: document.body,
    });
    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
    expect(screen.queryByText('Grafana Query Function')).toBeInTheDocument();
  });
  describe('log queries:', () => {
    it('should render', async () => {
      const props = {
        query: {
          refId: 'A',
          queryType: AzureQueryType.LogAnalytics,
          azureLogAnalytics: {
            query: 'test query',
          },
          subscription: 'id',
        },
        onChange: () => {},
        datasource: createMockDatasource(),
      };
      render(<VariableEditor {...props} />);
      await waitFor(() => screen.queryByTestId('mockeditor'));
      expect(screen.queryByText('Resource')).toBeInTheDocument();
      expect(screen.queryByTestId('mockeditor')).toBeInTheDocument();
    });

    it('should render with legacy query strings', async () => {
      const props = {
        query: 'test query',
        onChange: () => {},
        datasource: createMockDatasource(),
      };
      render(<VariableEditor {...props} />);
      await waitFor(() => screen.queryByTestId('mockeditor'));
      expect(screen.queryByText('Resource')).toBeInTheDocument();
      expect(screen.queryByTestId('mockeditor')).toBeInTheDocument();
    });
    it('should call on change if the query changes', async () => {
      const props = {
        query: {
          refId: 'A',
          queryType: AzureQueryType.LogAnalytics,
          azureLogAnalytics: {
            query: 'test query',
          },
          subscription: 'id',
        },
        onChange: jest.fn(),
        datasource: createMockDatasource(),
      };
      render(<VariableEditor {...props} />);
      await waitFor(() => screen.queryByTestId('mockeditor'));
      expect(screen.queryByTestId('mockeditor')).toBeInTheDocument();
      await userEvent.type(screen.getByTestId('mockeditor'), '{backspace}');
      expect(props.onChange).toHaveBeenCalledWith({
        azureLogAnalytics: {
          query: 'test quer',
        },
        queryType: 'Azure Log Analytics',
        refId: 'A',
        subscription: 'id',
      });
    });
  });

  describe('grafana template variable fn queries:', () => {
    it('should render', async () => {
      const props = {
        query: {
          refId: 'A',
          queryType: AzureQueryType.GrafanaTemplateVariableFn,
          grafanaTemplateVariableFn: {
            rawQuery: 'test query',
            kind: 'SubscriptionsQuery',
          },
          subscription: 'id',
        } as AzureMonitorQuery,
        onChange: () => {},
        datasource: createMockDatasource(),
      };
      render(<VariableEditor {...props} />);
      await waitFor(() => screen.queryByText('Grafana template variable function'));
      expect(screen.queryByText('Grafana template variable function')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('test query')).toBeInTheDocument();
    });

    it('should call on change if the query changes', async () => {
      const props = {
        query: {
          refId: 'A',
          queryType: AzureQueryType.GrafanaTemplateVariableFn,
          grafanaTemplateVariableFn: {
            rawQuery: 'Su',
            kind: 'UnknownQuery',
          },
          subscription: 'subscriptionId',
        } as AzureMonitorQuery,
        onChange: jest.fn(),
        datasource: createMockDatasource(),
      };
      render(<VariableEditor {...props} />);
      await waitFor(() => screen.queryByText('Grafana template variable function'));
      userEvent.type(screen.getByDisplayValue('Su'), 'bscriptions()');
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
});
