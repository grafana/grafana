import { act, render, screen } from '@testing-library/react';
import React from 'react';

import { config } from '@grafana/runtime';

import { setupMockedAPI } from '../__mocks__/API';
import { accountIdVariable, regionVariable } from '../__mocks__/CloudWatchDataSource';
import { MetricStat } from '../types';

import { Account } from './Account';

export const accounts = [
  {
    arn: 'arn:aws:iam::123456789012:root',
    id: '123456789012',
    label: 'test-account1',
    isMonitoringAccount: true,
  },
  {
    arn: 'arn:aws:iam::432156789012:root',
    id: '432156789013',
    label: 'test-account2',
    isMonitoringAccount: false,
  },
  {
    arn: 'arn:aws:iam::432156789013:root',
    id: '432156789014',
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
    accountId: '123456789012',
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
        render(<Account {...props} query={{ ...props.metricStat }} api={api} />);
      });
      expect(await screen.queryByLabelText('Account')).toBeNull();
      config.featureToggles.cloudwatchCrossAccountQuerying = originalValue;
    });

    it('should not be rendered when no accounts are found and accountId is defiend', async () => {
      await act(async () => {
        const mock = setupMockedAPI({ variables: [accountIdVariable] });
        mock.api.getAccounts = jest.fn().mockResolvedValue([]);
        await act(async () => {
          render(<Account {...props} query={{ ...props.metricStat }} api={mock.api} />);
        });
        expect(await screen.queryByLabelText('Account')).toBeNull();
      });
    });

    it('should not be rendered when no accounts are found and accountId is not defiend', async () => {
      await act(async () => {
        const mock = setupMockedAPI({ variables: [accountIdVariable] });
        mock.api.getAccounts = jest.fn().mockResolvedValue([]);
        const { container } = render(
          <Account {...props} query={{ ...props.metricStat, accountId: undefined }} api={mock.api} />
        );
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
              accountId: '58356789012',
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
              accountId: '58356789012',
            }}
            api={api}
          />
        );
      });
      expect(onChange).toHaveBeenCalledWith('all');
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
              accountId: 'all',
            }}
            api={api}
          />
        );
      });
      expect(onChange).not.toHaveBeenCalledWith();
      expect(await screen.getByText('All')).toBeInTheDocument();
    });

    it('should not unset accountId if the current value is in the loaded list of accounts', async () => {
      const api = setupMockedAPI().api;
      api.getAccounts = jest.fn().mockResolvedValue(accounts);
      const onChange = jest.fn();
      await act(async () => {
        render(
          <Account
            onChange={onChange}
            query={{
              ...props.metricStat,
              accountId: accounts[1].id,
            }}
            api={api}
          />
        );
      });
      expect(onChange).not.toHaveBeenCalled();
      expect(await screen.getByText(accounts[1].label)).toBeInTheDocument();
    });

    it('should display variable name in ui and not call onChange in case variable value exist in returned accounts array', async () => {
      const api = setupMockedAPI({ variables: [regionVariable, accountIdVariable] }).api;
      const onChange = jest.fn();
      api.getAccounts = jest.fn().mockResolvedValue(accounts);
      await act(async () => {
        render(<Account onChange={onChange} query={{ ...props.metricStat, accountId: '$accountId' }} api={api} />);
      });
      expect(await screen.getByText('$accountId')).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should not display variable name in ui and call onChange in case variable value does not exist in returned accounts array', async () => {
      const api = setupMockedAPI({ variables: [regionVariable, accountIdVariable] }).api;
      const onChange = jest.fn();
      api.getAccounts = jest.fn().mockResolvedValue(accounts);
      await act(async () => {
        render(
          <Account onChange={onChange} query={{ ...props.metricStat, accountId: '$unknownVariable' }} api={api} />
        );
      });
      expect(await screen.queryByText('$unknownVariable')).toBeNull();
      expect(onChange).toHaveBeenCalled();
    });
  });
});
