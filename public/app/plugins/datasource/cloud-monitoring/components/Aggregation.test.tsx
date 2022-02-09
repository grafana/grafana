import React from 'react';
import { render, screen } from '@testing-library/react';
import { shallow } from 'enzyme';
import { Select } from '@grafana/ui';
import { Aggregation, Props } from './Aggregation';
import { ValueTypes, MetricKind } from '../types';
import { TemplateSrvStub } from 'test/specs/helpers';

const props: Props = {
  onChange: () => {},
  // @ts-ignore
  templateSrv: new TemplateSrvStub(),
  metricDescriptor: {
    valueType: '',
    metricKind: '',
  } as any,
  crossSeriesReducer: '',
  groupBys: [],
  templateVariableOptions: [],
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
        } as any,
      };

      it('should not have the reduce values', () => {
        const wrapper = shallow(<Aggregation {...nextProps} />);
        const { options } = wrapper.find(Select).props() as any;
        const [, aggGroup] = options;

        expect(aggGroup.options.length).toEqual(11);
        expect(aggGroup.options.map((o: any) => o.value)).toEqual(
          expect.not.arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE'])
        );
      });
    });

    describe('when MONEY and CUMULATIVE is passed as props', () => {
      const nextProps = {
        ...props,
        metricDescriptor: {
          valueType: ValueTypes.MONEY,
          metricKind: MetricKind.CUMULATIVE,
        } as any,
      };

      it('should have the reduce values', () => {
        const wrapper = shallow(<Aggregation {...nextProps} />);
        const { options } = wrapper.find(Select).props() as any;
        const [, aggGroup] = options;

        expect(aggGroup.options.length).toEqual(11);
        expect(aggGroup.options.map((o: any) => o.value)).toEqual(expect.arrayContaining(['REDUCE_NONE']));
      });
    });
  });
});
