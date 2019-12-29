import React from 'react';
import renderer from 'react-test-renderer';
import { Aggregations, Props, setAggOptions } from './Aggregations';
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
    describe('when DOUBLE and DELTA is passed as props', () => {
      it('', () => {
        const options = setAggOptions(ValueTypes.DOUBLE, MetricKind.GAUGE).options;
        expect(options.length).toEqual(11);
        expect(options.map((o: any) => o.value)).toEqual(
          expect.not.arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE'])
        );
      });
    });

    describe('when MONEY and CUMULATIVE is passed as props', () => {
      it('', () => {
        const options = setAggOptions(ValueTypes.MONEY, MetricKind.CUMULATIVE).options;

        expect(options.length).toEqual(10);
        expect(options.map((o: any) => o.value)).toEqual(expect.arrayContaining(['REDUCE_NONE']));
      });
    });
  });
});
