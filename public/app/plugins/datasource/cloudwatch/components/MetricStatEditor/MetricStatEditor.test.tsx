import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import selectEvent from 'react-select-event';

import { config } from '@grafana/runtime';

import { MetricStatEditor } from '..';
import { setupMockedDataSource, statisticVariable } from '../../__mocks__/CloudWatchDataSource';
import { validMetricSearchBuilderQuery } from '../../__mocks__/queries';
import { MetricStat } from '../../types';

const originalFeatureToggleValue = config.featureToggles.cloudWatchCrossAccountQuerying;
const ds = setupMockedDataSource({
  variables: [statisticVariable],
});

ds.datasource.resources.getNamespaces = jest.fn().mockResolvedValue([]);
ds.datasource.resources.getMetrics = jest.fn().mockResolvedValue([]);
ds.datasource.resources.getDimensionKeys = jest.fn().mockResolvedValue([]);
ds.datasource.getVariables = jest.fn().mockReturnValue([]);
const metricStat: MetricStat = {
  region: 'us-east-2',
  namespace: '',
  metricName: '',
  dimensions: {},
  statistic: '',
  matchExact: true,
};

const props = {
  refId: 'A',
  datasource: ds.datasource,
  metricStat,
  onChange: jest.fn(),
};

describe('MetricStatEditor', () => {
  afterEach(() => {
    config.featureToggles.cloudWatchCrossAccountQuerying = originalFeatureToggleValue;
  });
  describe('statistics field', () => {
    test.each(['Average', 'p23.23', 'p34', '$statistic'])('should accept valid values', async (statistic) => {
      const onChange = jest.fn();

      render(<MetricStatEditor {...props} onChange={onChange} />);

      const statisticElement = await screen.findByLabelText('Statistic');
      expect(statisticElement).toBeInTheDocument();

      await userEvent.type(statisticElement, statistic);
      fireEvent.keyDown(statisticElement, { keyCode: 13 });
      expect(onChange).toHaveBeenCalledWith({ ...props.metricStat, statistic });
    });

    test.each(['CustomStat', 'p23,23', '$someUnknownValue'])('should not accept invalid values', async (statistic) => {
      const onChange = jest.fn();

      render(<MetricStatEditor {...props} onChange={onChange} />);

      const statisticElement = await screen.findByLabelText('Statistic');
      expect(statisticElement).toBeInTheDocument();

      await userEvent.type(statisticElement, statistic);
      fireEvent.keyDown(statisticElement, { keyCode: 13 });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('expressions', () => {
    it('should display match exact switch is not set', async () => {
      render(<MetricStatEditor {...props} />);
      expect(await screen.findByText('Match exact')).toBeInTheDocument();
    });

    it('should display match exact switch if prop is set to false', async () => {
      render(<MetricStatEditor {...props} disableExpressions={false} />);
      expect(await screen.findByText('Match exact')).toBeInTheDocument();
    });

    it('should not display match exact switch if prop is set to true', async () => {
      render(<MetricStatEditor {...props} disableExpressions={true} />);
      await waitFor(() => {
        expect(screen.queryByText('Match exact')).toBeNull();
      });
    });
  });

  describe('match exact', () => {
    it('should be checked when value is true', async () => {
      render(<MetricStatEditor {...props} disableExpressions={false} />);
      expect(await screen.findByLabelText('Match exact - optional')).toBeChecked();
    });

    it('should be unchecked when value is false', async () => {
      render(
        <MetricStatEditor
          {...props}
          metricStat={{ ...props.metricStat, matchExact: false }}
          disableExpressions={false}
        />
      );
      expect(await screen.findByLabelText('Match exact - optional')).not.toBeChecked();
    });
  });

  describe('validating Query namespace / metricName', () => {
    const namespaces = [
      { value: 'n1', label: 'n1', text: 'n1' },
      { value: 'n2', label: 'n2', text: 'n2' },
    ];
    const metrics = [
      { value: 'm1', label: 'm1', text: 'm1' },
      { value: 'm2', label: 'm2', text: 'm2' },
    ];
    const onChange = jest.fn();
    const propsNamespaceMetrics = {
      ...props,
      onChange,
    };

    beforeEach(() => {
      propsNamespaceMetrics.datasource.resources.getNamespaces = jest.fn().mockResolvedValue(namespaces);
      propsNamespaceMetrics.datasource.resources.getMetrics = jest.fn().mockResolvedValue(metrics);
      onChange.mockClear();
    });

    it('should select namespace and metric name correctly', async () => {
      await act(async () => {
        render(<MetricStatEditor {...propsNamespaceMetrics} />);
      });

      const namespaceSelect = screen.getByLabelText('Namespace');
      const metricsSelect = screen.getByLabelText('Metric name');
      expect(namespaceSelect).toBeInTheDocument();
      expect(metricsSelect).toBeInTheDocument();

      await selectEvent.select(namespaceSelect, 'n1', { container: document.body });
      await selectEvent.select(metricsSelect, 'm1', { container: document.body });

      expect(onChange.mock.calls).toEqual([
        [{ ...propsNamespaceMetrics.metricStat, namespace: 'n1' }], // First call, namespace select
        [{ ...propsNamespaceMetrics.metricStat, metricName: 'm1' }], // Second call, metric select
      ]);
    });

    it('should remove metricName from metricStat if it does not exist in new namespace', async () => {
      propsNamespaceMetrics.datasource.resources.getMetrics = jest.fn().mockImplementation(({ namespace, region }) => {
        let mockMetrics =
          namespace === 'n1' && region === props.metricStat.region
            ? metrics
            : [{ value: 'oldNamespaceMetric', label: 'oldNamespaceMetric', text: 'oldNamespaceMetric' }];
        return Promise.resolve(mockMetrics);
      });
      propsNamespaceMetrics.metricStat.metricName = 'oldNamespaceMetric';
      propsNamespaceMetrics.metricStat.namespace = 'n2';

      await act(async () => {
        render(<MetricStatEditor {...propsNamespaceMetrics} />);
      });
      const namespaceSelect = screen.getByLabelText('Namespace');
      expect(screen.getByText('n2')).toBeInTheDocument();
      expect(screen.getByText('oldNamespaceMetric')).toBeInTheDocument();

      await waitFor(() => selectEvent.select(namespaceSelect, 'n1', { container: document.body }));

      expect(onChange.mock.calls).toEqual([[{ ...propsNamespaceMetrics.metricStat, metricName: '', namespace: 'n1' }]]);
    });

    it('should not remove metricName from metricStat if it does exist in new namespace', async () => {
      propsNamespaceMetrics.metricStat.namespace = 'n1';
      propsNamespaceMetrics.metricStat.metricName = 'm1';

      await act(async () => {
        render(<MetricStatEditor {...propsNamespaceMetrics} />);
      });
      const namespaceSelect = screen.getByLabelText('Namespace');
      expect(screen.getByText('n1')).toBeInTheDocument();
      expect(screen.getByText('m1')).toBeInTheDocument();

      await waitFor(() => selectEvent.select(namespaceSelect, 'n2', { container: document.body }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls).toEqual([
        [{ ...propsNamespaceMetrics.metricStat, metricName: 'm1', namespace: 'n2' }],
      ]);
    });
  });

  describe('metric value', () => {
    it('should be displayed when a custom value is used and its value is not in the select options', async () => {
      const expected = 'CPUUtilzation';
      await act(async () => {
        render(<MetricStatEditor {...props} metricStat={{ ...props.metricStat, metricName: expected }} />);
      });
      expect(await screen.findByText(expected)).toBeInTheDocument();
    });
  });

  describe('account id', () => {
    it('should set value to "all" when its a monitoring account and no account id is defined in the query', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = true;
      const onChange = jest.fn();
      props.datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(true);
      props.datasource.resources.getAccounts = jest.fn().mockResolvedValue([
        {
          value: '123456789',
          label: 'test-account1',
          description: '123456789',
        },
        {
          value: '432156789013',
          label: 'test-account2',
          description: '432156789013',
        },
      ]);
      await act(async () => {
        render(
          <MetricStatEditor
            {...props}
            metricStat={{ ...validMetricSearchBuilderQuery, accountId: undefined }}
            onChange={onChange}
          />
        );
      });
      expect(onChange).toHaveBeenCalledWith({ ...validMetricSearchBuilderQuery, accountId: 'all' });
      expect(await screen.findByText('Account')).toBeInTheDocument();
    });

    it('should unset value when no accounts were found and an account id is defined in the query', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = true;
      const onChange = jest.fn();
      props.datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
      props.datasource.resources.getAccounts = jest.fn().mockResolvedValue([]);
      await act(async () => {
        render(
          <MetricStatEditor
            {...props}
            metricStat={{ ...validMetricSearchBuilderQuery, accountId: '123456789' }}
            onChange={onChange}
          />
        );
      });
      expect(onChange).toHaveBeenCalledWith({ ...validMetricSearchBuilderQuery, accountId: undefined });
      expect(await screen.queryByText('Account')).not.toBeInTheDocument();
    });
  });
});
