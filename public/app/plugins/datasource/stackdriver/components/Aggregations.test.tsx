import React from 'react';
import renderer from 'react-test-renderer';
import { Aggregations, Props } from './Aggregations';
import { shallow } from 'enzyme';
import { ValueTypes, MetricKind } from '../constants';
import { TemplateSrvStub } from 'test/specs/helpers';

const props: Props = {
  onChange: () => {},
  templateSrv: new TemplateSrvStub(),
  metricDescriptor: {
    valueType: '',
    metricKind: '',
  },
  crossSeriesReducer: '',
  groupBys: [],
  children: renderProps => <div />,
};

describe('Aggregations', () => {
  let wrapper;
  it('renders correctly', () => {
    const tree = renderer.create(<Aggregations {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  describe('options', () => {
    describe('when DOUBLE and DELTA is passed as props', () => {
      beforeEach(() => {
        const newProps = { ...props, metricDescriptor: { valueType: ValueTypes.DOUBLE, metricKind: MetricKind.GAUGE } };
        wrapper = shallow(<Aggregations {...newProps} />);
      });
      it('', () => {
        const options = wrapper.state().aggOptions[0].options;
        expect(options.length).toEqual(11);
        expect(options.map(o => o.value)).toEqual(
          expect.not.arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE'])
        );
      });
    });

    describe('when MONEY and CUMULATIVE is passed as props', () => {
      beforeEach(() => {
        const newProps = {
          ...props,
          metricDescriptor: { valueType: ValueTypes.MONEY, metricKind: MetricKind.CUMULATIVE },
        };
        wrapper = shallow(<Aggregations {...newProps} />);
      });
      it('', () => {
        const options = wrapper.state().aggOptions[0].options;

        expect(options.length).toEqual(10);
        expect(options.map(o => o.value)).toEqual(expect.arrayContaining(['REDUCE_NONE']));
      });
    });
  });
});
