import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { setupMockedDataSource } from '../../../mocks/CloudWatchDataSource';
import { CloudWatchMetricsQuery } from '../../../types';

import { Dimensions } from './Dimensions';

const ds = setupMockedDataSource({
  variables: [],
});

ds.datasource.resources.getNamespaces = jest.fn().mockResolvedValue([]);
ds.datasource.resources.getMetrics = jest.fn().mockResolvedValue([]);
ds.datasource.resources.getDimensionKeys = jest.fn().mockResolvedValue([]);
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
  disableExpressions: false,
  onChange: jest.fn(),
};

describe('Dimensions', () => {
  describe('when rendered with two existing dimensions', () => {
    it('should render two filter items', async () => {
      props.query.dimensions = {
        InstanceId: '*',
        InstanceGroup: 'Group1',
      };
      render(<Dimensions {...props} metricStat={props.query} />);
      const filterItems = await screen.findAllByTestId('cloudwatch-dimensions-filter-item');
      expect(filterItems.length).toBe(2);

      expect(within(filterItems[0]).getByText('InstanceId')).toBeInTheDocument();
      expect(within(filterItems[0]).getByText('*')).toBeInTheDocument();

      expect(within(filterItems[1]).getByText('InstanceGroup')).toBeInTheDocument();
      expect(within(filterItems[1]).getByText('Group1')).toBeInTheDocument();
    });
  });

  describe('when rendered with two existing dimensions and values are represented as arrays', () => {
    it('should render two filter items', async () => {
      props.query.dimensions = {
        InstanceId: ['*'],
        InstanceGroup: ['Group1'],
      };
      render(<Dimensions {...props} metricStat={props.query} />);
      const filterItems = await screen.findAllByTestId('cloudwatch-dimensions-filter-item');
      expect(filterItems.length).toBe(2);

      expect(within(filterItems[0]).getByText('InstanceId')).toBeInTheDocument();
      expect(within(filterItems[0]).getByText('*')).toBeInTheDocument();

      expect(within(filterItems[1]).getByText('InstanceGroup')).toBeInTheDocument();
      expect(within(filterItems[1]).getByText('Group1')).toBeInTheDocument();
    });
  });

  describe('when adding a new filter item', () => {
    it('it should add the new item but not call onChange', async () => {
      props.query.dimensions = {};
      const onChange = jest.fn();
      render(<Dimensions {...props} metricStat={props.query} onChange={onChange} />);

      await userEvent.click(screen.getByLabelText('Add'));
      expect(screen.getByTestId('cloudwatch-dimensions-filter-item')).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('when adding a new filter item with key', () => {
    it('it should add the new item but not call onChange', async () => {
      props.query.dimensions = {};
      const onChange = jest.fn();
      const { container } = render(<Dimensions {...props} metricStat={props.query} onChange={onChange} />);

      await userEvent.click(screen.getByLabelText('Add'));
      const filterItemElement = screen.getByTestId('cloudwatch-dimensions-filter-item');
      expect(filterItemElement).toBeInTheDocument();

      const keyElement = container.querySelector('#cloudwatch-dimensions-filter-item-key');
      expect(keyElement).toBeInTheDocument();
      await userEvent.type(keyElement!, 'my-key');
      fireEvent.keyDown(keyElement!, { keyCode: 13 });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('when adding a new filter item with key and value', () => {
    it('it should add the new item and trigger onChange', async () => {
      props.query.dimensions = {};
      const onChange = jest.fn();
      const { container } = render(<Dimensions {...props} metricStat={props.query} onChange={onChange} />);

      const label = await screen.findByLabelText('Add');
      await userEvent.click(label);
      const filterItemElement = screen.getByTestId('cloudwatch-dimensions-filter-item');
      expect(filterItemElement).toBeInTheDocument();

      const keyElement = container.querySelector('#cloudwatch-dimensions-filter-item-key');
      expect(keyElement).toBeInTheDocument();
      await userEvent.type(keyElement!, 'my-key');
      fireEvent.keyDown(keyElement!, { keyCode: 13 });
      expect(onChange).not.toHaveBeenCalled();

      const valueElement = container.querySelector('#cloudwatch-dimensions-filter-item-value');
      expect(valueElement).toBeInTheDocument();
      await userEvent.type(valueElement!, 'my-value');
      fireEvent.keyDown(valueElement!, { keyCode: 13 });
      expect(onChange).toHaveBeenCalledWith({
        'my-key': 'my-value',
      });
    });
  });
});
