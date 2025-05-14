import { render, screen } from '@testing-library/react';
import { openMenu } from 'react-select-event';

import { MetricKind, ValueTypes } from '../types/query';
import { MetricDescriptor } from '../types/types';

import { Aggregation, Props } from './Aggregation';

const props: Props = {
  onChange: () => {},
  metricDescriptor: {
    valueType: '',
    metricKind: '',
  } as unknown as MetricDescriptor,
  crossSeriesReducer: '',
  groupBys: [],
  templateVariableOptions: [],
  refId: 'A',
};

describe('Aggregation', () => {
  it('renders correctly', () => {
    render(<Aggregation {...props} />);
    expect(screen.getByTestId('cloud-monitoring-aggregation')).toBeInTheDocument();
  });

  describe('options', () => {
    describe('when DOUBLE and GAUGE is passed as props', () => {
      const nextProps = {
        ...props,
        metricDescriptor: {
          valueType: ValueTypes.DOUBLE,
          metricKind: MetricKind.GAUGE,
        } as MetricDescriptor,
      };

      it('should not have the reduce values', () => {
        render(<Aggregation {...nextProps} />);
        const label = screen.getByLabelText('Group by function');
        openMenu(label);
        expect(screen.queryByText('count true')).not.toBeInTheDocument();
        expect(screen.queryByText('count false')).not.toBeInTheDocument();
      });
    });

    describe('when MONEY and CUMULATIVE is passed as props', () => {
      const nextProps = {
        ...props,
        metricDescriptor: {
          valueType: ValueTypes.MONEY,
          metricKind: MetricKind.CUMULATIVE,
        } as MetricDescriptor,
      };

      it('should have the reduce values', () => {
        render(<Aggregation {...nextProps} />);
        const label = screen.getByLabelText('Group by function');
        openMenu(label);
        expect(screen.getByText('none')).toBeInTheDocument();
      });
    });
  });
});
