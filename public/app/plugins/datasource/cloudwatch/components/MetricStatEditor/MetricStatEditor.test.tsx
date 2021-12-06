import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setupMockedDataSource } from '../../__mocks__/CloudWatchDataSource';
import '@testing-library/jest-dom';
import { CloudWatchMetricsQuery } from '../../types';
import userEvent from '@testing-library/user-event';
import { MetricStatEditor } from '..';

const ds = setupMockedDataSource({
  variables: [],
});

ds.datasource.getNamespaces = jest.fn().mockResolvedValue([]);
ds.datasource.getMetrics = jest.fn().mockResolvedValue([]);
ds.datasource.getDimensionKeys = jest.fn().mockResolvedValue([]);
ds.datasource.getVariables = jest.fn().mockReturnValue([]);
const q: CloudWatchMetricsQuery = {
  id: '',
  region: 'us-east-2',
  namespace: '',
  period: '',
  alias: '',
  metricName: '',
  dimensions: {},
  matchExact: true,
  statistic: '',
  expression: '',
  refId: '',
};

const props = {
  datasource: ds.datasource,
  query: q,
  onChange: jest.fn(),
  onRunQuery: jest.fn(),
};

afterEach(cleanup);

describe('MetricStatEditor', () => {
  describe('statistics field', () => {
    test.each([['Average', 'p23.23', 'p34', '$statistic']])('should accept valid values', (statistic) => {
      const onChange = jest.fn();
      const onRunQuery = jest.fn();
      props.datasource.getVariables = jest.fn().mockReturnValue(['$statistic']);

      render(<MetricStatEditor {...props} onChange={onChange} onRunQuery={onRunQuery} />);

      const statisticElement = screen.getByLabelText('Statistic');
      expect(statisticElement).toBeInTheDocument();

      userEvent.type(statisticElement!, statistic);
      fireEvent.keyDown(statisticElement!, { keyCode: 13 });
      expect(onChange).toHaveBeenCalledWith({ ...props.query, statistic });
      expect(onRunQuery).toHaveBeenCalled();
    });

    test.each([['CustomStat', 'p23,23', '$statistic']])('should not accept invalid values', (statistic) => {
      const onChange = jest.fn();
      const onRunQuery = jest.fn();

      render(<MetricStatEditor {...props} onChange={onChange} onRunQuery={onRunQuery} />);

      const statisticElement = screen.getByLabelText('Statistic');
      expect(statisticElement).toBeInTheDocument();

      userEvent.type(statisticElement!, statistic);
      fireEvent.keyDown(statisticElement!, { keyCode: 13 });
      expect(onChange).not.toHaveBeenCalled();
      expect(onRunQuery).not.toHaveBeenCalled();
    });
  });

  describe('expressions', () => {
    it('should display match exact switch is not set', () => {
      render(<MetricStatEditor {...props} />);
      expect(screen.getByText('Match exact')).toBeInTheDocument();
    });

    it('should display match exact switch if prop is set to false', () => {
      render(<MetricStatEditor {...props} disableExpressions={false} />);
      expect(screen.getByText('Match exact')).toBeInTheDocument();
    });

    it('should not display match exact switch if prop is set to true', async () => {
      render(<MetricStatEditor {...props} disableExpressions={true} />);
      expect(screen.queryByText('Match exact')).toBeNull();
    });
  });

  describe('match exact', () => {
    it('should be checked when value is true', () => {
      render(<MetricStatEditor {...props} disableExpressions={false} />);
      expect(screen.getByLabelText('Match exact - optional')).toBeChecked();
    });

    it('should be unchecked when value is false', () => {
      render(<MetricStatEditor {...props} query={{ ...props.query, matchExact: false }} disableExpressions={false} />);
      expect(screen.getByLabelText('Match exact - optional')).not.toBeChecked();
    });
  });
});
