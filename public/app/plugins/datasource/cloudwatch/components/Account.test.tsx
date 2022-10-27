import { act, render, screen } from '@testing-library/react';
import React from 'react';

import { config } from '@grafana/runtime';

import { setupMockedAPI } from '../__mocks__/API';
import { MetricStat } from '../types';

import { Account } from './Account';

export const accounts = [
  {
    arn: 'arn:aws:iam::123456789012:root',
    accountId: '123456789012',
    label: 'test-account',
    isMonitoringAccount: true,
  },
  {
    arn: 'arn:aws:iam::432156789012:root',
    accountId: '432156789012',
    label: 'test-account2',
    isMonitoringAccount: false,
  },
  {
    arn: 'arn:aws:iam::987656789012:root',
    accountId: '432156789012',
    label: 'test-account3',
    isMonitoringAccount: false,
  },
];

describe('Account', () => {
  const metricStat: MetricStat = {
    region: 'us-east-2',
    namespace: '',
    metricName: '',
    dimensions: {},
    statistic: '',
    matchExact: true,
    accountInfo: {
      crossAccount: false,
      account: {
        arn: 'arn:aws:iam::123456789012:root',
        id: '123456789012',
        label: 'test-account',
        isMonitoringAccount: true,
      },
    },
  };

  const props = {
    api: setupMockedAPI().api,
    metricStat,
    onChange: jest.fn(),
  };

  describe('account field', () => {
    config.featureToggles.cloudwatchCrossAccountQuerying = true;
    it('should be rendered when feature toggle is enabled', async () => {
      const originalValue = config.featureToggles.cloudwatchCrossAccountQuerying;
      config.featureToggles.cloudwatchCrossAccountQuerying = true;
      const api = setupMockedAPI().api;
      api.getAccounts = jest.fn().mockResolvedValue([
        {
          arn: 'arn:aws:iam::123456789012:root',
          accountId: '123456789012',
          label: 'test-account',
          isMonitoringAccount: true,
        },
      ]);
      await act(async () => {
        render(<Account {...props} query={{ ...props.metricStat }} api={api} />);
      });
      expect(await screen.getByLabelText('Account')).toBeInTheDocument();
      config.featureToggles.cloudwatchCrossAccountQuerying = originalValue;
    });

    it('should not be rendered when feature toggle is not enabled', async () => {
      let api = setupMockedAPI().api;
      api.getAccounts = jest.fn().mockResolvedValue(accounts);
      const originalValue = config.featureToggles.cloudwatchCrossAccountQuerying;
      config.featureToggles.cloudwatchCrossAccountQuerying = false;
      await act(async () => {
        const { container } = render(<Account {...props} query={{ ...props.metricStat }} api={api} />);
        expect(container).toBeEmptyDOMElement();
        config.featureToggles.cloudwatchCrossAccountQuerying = originalValue;
      });
    });

    it('should not be rendered when no accounts are found', async () => {
      await act(async () => {
        const mock = setupMockedAPI();
        mock.api.getAccounts = jest.fn().mockResolvedValue([]);
        const { container } = render(<Account {...props} query={{ ...props.metricStat }} api={mock.api} />);
        expect(container).toBeEmptyDOMElement();
      });
    });

    it('should not be rendered and should unset accountArn when api returns an error', async () => {
      const mock = setupMockedAPI();
      mock.api.getAccounts = jest.fn().mockRejectedValue(new Error('error'));
      const onChange = jest.fn();
      await act(async () => {
        const { container } = render(<Account onChange={onChange} query={{ ...props.metricStat }} api={mock.api} />);
        expect(container).toBeEmptyDOMElement();
      });
      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('should not be rendered and should unset accountArn when api returns an empty list of accounts', async () => {
      const mock = setupMockedAPI();
      mock.api.getAccounts = jest.fn().mockResolvedValue([]);
      const onChange = jest.fn();
      await act(async () => {
        const { container } = render(
          <Account
            onChange={onChange}
            query={{
              ...props.metricStat,
              accountInfo: {
                crossAccount: false,
                account: {
                  arn: 'arn:aws:iam::58356789012:root',
                  id: '58356789012',
                  label: 'some label',
                  isMonitoringAccount: true,
                },
              },
            }}
            api={mock.api}
          />
        );
        expect(container).toBeEmptyDOMElement();
      });
      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('should set accountArn to "all" if the current value is not in the loaded list of accounts', async () => {
      const api = setupMockedAPI().api;
      api.getAccounts = jest.fn().mockResolvedValue(accounts);
      const onChange = jest.fn();
      await act(async () => {
        render(
          <Account
            onChange={onChange}
            query={{
              ...props.metricStat,
              accountInfo: {
                crossAccount: false,
                account: {
                  arn: 'arn:aws:iam::58356789012:root',
                  label: '',
                  id: '58356789012',
                  isMonitoringAccount: true,
                },
              },
            }}
            api={api}
          />
        );
      });
      expect(onChange).toHaveBeenCalledWith({ crossAccount: true });
    });

    it('should render "all" if crossAccount is stored in the query model', async () => {
      const api = setupMockedAPI().api;
      api.getAccounts = jest.fn().mockResolvedValue(accounts);
      const onChange = jest.fn();
      await act(async () => {
        render(
          <Account
            onChange={onChange}
            query={{
              ...props.metricStat,
              accountInfo: {
                crossAccount: true,
              },
            }}
            api={api}
          />
        );
      });
      expect(onChange).not.toHaveBeenCalledWith();
      expect(await screen.getByText('All')).toBeInTheDocument();
    });

    it('should not unset accountArn if the current value is in the loaded list of accounts', async () => {
      const api = setupMockedAPI().api;
      api.getAccounts = jest.fn().mockResolvedValue(accounts);
      const onChange = jest.fn();
      await act(async () => {
        render(
          <Account
            onChange={onChange}
            query={{
              ...props.metricStat,
              accountInfo: {
                crossAccount: false,
                account: {
                  arn: 'arn:aws:iam::432156789012:root',
                  label: '',
                  id: '432156789012',
                  isMonitoringAccount: true,
                },
              },
            }}
            api={api}
          />
        );
      });
      expect(onChange).not.toHaveBeenCalled();
      expect(await screen.getByText('test-account2')).toBeInTheDocument();
    });

    it('should add "Monitoring account" text to the display label if its a monitoring account', async () => {
      const api = setupMockedAPI().api;
      api.getAccounts = jest.fn().mockResolvedValue(accounts);
      await act(async () => {
        render(<Account onChange={jest.fn()} query={{ ...props.metricStat }} api={api} />);
      });
      expect(await screen.getByText('test-account (Monitoring account)')).toBeInTheDocument();
    });
  });
});
