import { fireEvent, render, screen } from '@testing-library/react';

import { OpenTsdbQuery } from '../types';

import { MetricSection, MetricSectionProps, testIds } from './MetricSection';

const onRunQuery = jest.fn();
const onChange = jest.fn();

const setup = (propOverrides?: Object) => {
  const suggestMetrics = jest.fn();
  const query: OpenTsdbQuery = {
    metric: 'cpu',
    refId: 'A',
    aggregator: 'avg',
    alias: 'alias',
  };

  const varQuery: OpenTsdbQuery = {
    metric: '$variable',
    refId: 'A',
    aggregator: 'avg',
    alias: 'alias',
  };

  const props: MetricSectionProps = {
    query: !propOverrides ? query : varQuery,
    onChange: onChange,
    onRunQuery: onRunQuery,
    suggestMetrics: suggestMetrics,
    aggregators: ['avg'],
  };

  Object.assign(props, propOverrides);

  return render(<MetricSection {...props} />);
};
describe('MetricSection', () => {
  it('should render metrics section', () => {
    setup();
    expect(screen.getByTestId(testIds.section)).toBeInTheDocument();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe('metric aggregator', () => {
    it('should render metrics select', () => {
      setup();
      expect(screen.getByText('cpu')).toBeInTheDocument();
    });

    it('should display variables in the metrics select', () => {
      setup({ variables: true });
      expect(screen.getByText('$variable')).toBeInTheDocument();
    });
  });

  describe('metric aggregator', () => {
    it('should render the metrics aggregator', () => {
      setup();
      expect(screen.getByText('avg')).toBeInTheDocument();
    });
  });

  describe('metric alias', () => {
    it('should render the alias input', () => {
      setup();
      expect(screen.getByTestId('metric-alias')).toBeInTheDocument();
    });

    it('should fire OnRunQuery on blur', () => {
      setup();
      const alias = screen.getByTestId('metric-alias');
      fireEvent.click(alias);
      fireEvent.blur(alias);
      expect(onRunQuery).toHaveBeenCalled();
    });
  });
});
