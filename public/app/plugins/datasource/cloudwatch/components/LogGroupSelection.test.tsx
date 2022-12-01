import { render, screen, waitFor } from '@testing-library/react';
// eslint-disable-next-line lodash/import-scope
import lodash from 'lodash';
import React from 'react';

import { config } from '@grafana/runtime';

import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';
import { CloudWatchLogsQuery } from '../types';

import { LogGroupSelection } from './LogGroupSelection';

const originalFeatureToggleValue = config.featureToggles.cloudWatchCrossAccountQuerying;
const originalDebounce = lodash.debounce;

const defaultProps = {
  datasource: setupMockedDataSource().datasource,
  query: {
    queryMode: 'Logs',
    id: '',
    region: '',
    refId: '',
  } as CloudWatchLogsQuery,
  onChange: jest.fn(),
  onRunQuery: jest.fn(),
};
describe('LogGroupSelection', () => {
  beforeEach(() => {
    lodash.debounce = jest.fn().mockImplementation((fn) => {
      fn.cancel = () => {};
      return fn;
    });
  });
  afterEach(() => {
    config.featureToggles.cloudWatchCrossAccountQuerying = originalFeatureToggleValue;
    lodash.debounce = originalDebounce;
  });
  it('renders the old logGroupSelector when the feature toggle is disabled and there are no linked accounts', async () => {
    config.featureToggles.cloudWatchCrossAccountQuerying = false;
    render(<LogGroupSelection {...defaultProps} />);
    await waitFor(() => screen.getByText('Choose Log Groups'));
    expect(screen.queryByText('Select Log Groups')).not.toBeInTheDocument();
  });
  it('renders the old logGroupSelector when the feature toggle is disabled but there are linked accounts', async () => {
    config.featureToggles.cloudWatchCrossAccountQuerying = false;
    const ds = setupMockedDataSource().datasource;
    ds.api.getAccounts = () =>
      Promise.resolve([
        {
          arn: 'arn',
          id: 'accountId',
          label: 'label',
          isMonitoringAccount: true,
        },
      ]);

    render(<LogGroupSelection {...defaultProps} datasource={ds} />);
    await waitFor(() => screen.getByText('Choose Log Groups'));
    expect(screen.queryByText('Select Log Groups')).not.toBeInTheDocument();
  });

  it('renders the old logGroupSelector when the feature toggle is enabled but there are no linked accounts', async () => {
    config.featureToggles.cloudWatchCrossAccountQuerying = true;
    render(<LogGroupSelection {...defaultProps} />);
    await waitFor(() => screen.getByText('Choose Log Groups'));
    expect(screen.queryByText('Select Log Groups')).not.toBeInTheDocument();
  });

  it('renders the new logGroupSelector when the feature toggle is enabled and there are linked accounts', async () => {
    config.featureToggles.cloudWatchCrossAccountQuerying = true;
    const ds = setupMockedDataSource().datasource;
    ds.api.getAccounts = () =>
      Promise.resolve([
        {
          arn: 'arn',
          id: 'accountId',
          label: 'label',
          isMonitoringAccount: true,
        },
      ]);

    render(<LogGroupSelection {...defaultProps} datasource={ds} />);
    await waitFor(() => screen.getByText('Select Log Groups'));
    expect(screen.queryByText('Choose Log Groups')).not.toBeInTheDocument();
  });
});
