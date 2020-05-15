import React from 'react';
import renderer from 'react-test-renderer';
import { shallow } from 'enzyme';
import { Segment } from '@grafana/ui';
import { Aggregations, Props } from './Aggregations';
import { ValueTypes, MetricKind } from '../constants';
import { TemplateSrvStub } from 'test/specs/helpers';

const props: Props = {
  onChange: () => {},
  // @ts-ignore
  templateSrv: new TemplateSrvStub(),
  metricDescriptor: {
    valueType: '',
    metricKind: '',
  },
  crossSeriesReducer: '',
  groupBys: [],
  children: renderProps => <div />,
  templateVariableOptions: [],
};

describe('Aggregations', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<Aggregations {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  describe('options', () => {
    describe('when DOUBLE and GAUGE is passed as props', () => {
      const nextProps = {
        ...props,
        metricDescriptor: {
          valueType: ValueTypes.DOUBLE,
          metricKind: MetricKind.GAUGE,
        },
      };

      it('should not have the reduce values', () => {
        const wrapper = shallow(<Aggregations {...nextProps} />);
        const { options } = wrapper.find(Segment).props() as any;
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
        },
      };

      it('should have the reduce values', () => {
        const wrapper = shallow(<Aggregations {...nextProps} />);
        const { options } = wrapper.find(Segment).props() as any;
        const [, aggGroup] = options;

        expect(aggGroup.options.length).toEqual(10);
        expect(aggGroup.options.map((o: any) => o.value)).toEqual(expect.arrayContaining(['REDUCE_NONE']));
      });
    });
  });
});
