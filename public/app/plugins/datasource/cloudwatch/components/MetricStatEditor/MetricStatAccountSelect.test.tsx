import { render, waitFor, screen } from '@testing-library/react';
import React from 'react';
import selectEvent from 'react-select-event';

import { config } from '@grafana/runtime';

import { CloudWatchAPI } from '../../api';
import { ResourceRequest } from '../../types';

import { MetricStatAccountSelect } from './MetricStatAccountSelect';

const originalFeatureToggleValue = config.featureToggles.cloudWatchCrossAccountQuerying;
const defaultProps = {
  api: {
    getAccounts: jest.fn(),
    templateSrv: {
      replace: jest.fn(),
    },
    getVariables: jest.fn(() => []),
  } as unknown as CloudWatchAPI,

  metricStat: {
    region: 'region',
    namespace: 'namespace',
  },
  onChange: jest.fn(),
  onRunQuery: jest.fn(),
};
describe('MetricStatAccountSelect', () => {
  afterEach(() => {
    config.featureToggles.cloudWatchCrossAccountQuerying = originalFeatureToggleValue;
  });
  it('calls on change to clear the account id if the account id is not a valid account in the options list', async () => {
    const mockApi = defaultProps.api;
    mockApi.getAccounts = ({ region }: ResourceRequest) => {
      const fakeAccount = {
        arn: 'arn',
        id: 'id',
        label: 'label',
        isMonitoringAccount: false,
      };
      return Promise.resolve([fakeAccount]);
    };
    const mockOnChange = jest.fn();
    render(
      <MetricStatAccountSelect
        {...defaultProps}
        metricStat={{ ...defaultProps.metricStat, accountId: 'someOldAccountId' }}
        onChange={mockOnChange}
      />
    );
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(mockOnChange).toBeCalledWith({
      accountId: '',
      namespace: 'namespace',
      region: 'region',
    });
  });

  it('calls onChange with account id set to all if there is no account selection but there are valid accounts', async () => {
    config.featureToggles.cloudWatchCrossAccountQuerying = true;
    const mockApi = defaultProps.api;
    mockApi.getAccounts = ({ region }: ResourceRequest) => {
      const fakeAccount = {
        arn: 'arn',
        id: 'id',
        label: 'label',
        isMonitoringAccount: false,
      };
      return Promise.resolve([fakeAccount]);
    };
    const mockOnChange = jest.fn();
    render(
      <MetricStatAccountSelect
        {...defaultProps}
        metricStat={{ ...defaultProps.metricStat, accountId: '' }}
        onChange={mockOnChange}
      />
    );
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(mockOnChange).toBeCalledWith({
      accountId: 'all',
      namespace: 'namespace',
      region: 'region',
    });
  });

  it('clears the accountId selection if there is an error loading accounts', async () => {
    config.featureToggles.cloudWatchCrossAccountQuerying = true;
    const mockApi = defaultProps.api;
    mockApi.getAccounts = ({ region }: ResourceRequest) => {
      return Promise.reject(new Error('permission denied and the server exploded'));
    };
    const mockOnChange = jest.fn();
    render(
      <MetricStatAccountSelect
        {...defaultProps}
        metricStat={{ ...defaultProps.metricStat, accountId: 'someOldAccountId' }}
        onChange={mockOnChange}
      />
    );
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(mockOnChange).toBeCalledWith({
      accountId: '',
      namespace: 'namespace',
      region: 'region',
    });
  });

  it('renders a select component with the account selection from the metricStat', async () => {
    config.featureToggles.cloudWatchCrossAccountQuerying = true;
    const mockApi = defaultProps.api;
    mockApi.getAccounts = ({ region }: ResourceRequest) => {
      return Promise.resolve([
        {
          arn: 'arn',
          id: 'id',
          label: 'label',
          isMonitoringAccount: false,
        },
        {
          arn: 'arn2',
          id: 'id2',
          label: 'label2',
          isMonitoringAccount: false,
        },
      ]);
    };
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    render(
      <MetricStatAccountSelect
        {...defaultProps}
        metricStat={{ ...defaultProps.metricStat, accountId: 'someOldAccountId' }}
        onChange={onChange}
        onRunQuery={onRunQuery}
      />
    );
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Account Selection')).toBeInTheDocument();
    await selectEvent.select(screen.getByLabelText('Account Selection'), 'label2', { container: document.body });
    expect(onChange).toBeCalledWith({
      accountId: 'id2',
      namespace: 'namespace',
      region: 'region',
    });
    expect(onRunQuery).toBeCalledTimes(1);
  });
});
