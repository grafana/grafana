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
});
