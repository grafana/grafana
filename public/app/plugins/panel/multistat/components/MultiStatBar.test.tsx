import _ from 'lodash';
import React from 'react';
import { shallow } from 'enzyme';

import { MultiStatBar, MultiStatBarProps } from './MultiStatBar';
import { BarStat } from './BarStat';

describe('<MultiStatBar />', () => {
  let props: MultiStatBarProps;

  beforeEach(() => {
    props = {
      stats: [
        { label: 'series_1', value: 10, valueFormatted: '10%', flotpairs: [[1000, 10], [2000, 10]] },
        { label: 'series_2', value: 20, valueFormatted: '20%', flotpairs: [[1000, 20], [2000, 20]] },
        { label: 'series_3', value: 15, valueFormatted: '15%', flotpairs: [[1000, 15], [2000, 15]] },
      ],
      size: { w: 600, h: 150 },
      options: {
        layout: 'vertical',
        colorValue: true,
        sparkline: { show: false },
      },
      getColor: getColorMock,
    };
  });

  it('should render component', () => {
    const wrapper = shallow(<MultiStatBar {...props} />);
    expect(wrapper.find(BarStat)).toHaveLength(3);
    expect(wrapper.find(BarStat).get(0).props.height).toBe(50);
    expect(wrapper.find(BarStat).get(0).props.label).toBe('series_1');
    expect(wrapper.find(BarStat).get(0).props.value).toBe('10%');
  });

  it('should set bar length depending on value', () => {
    const wrapper = shallow(<MultiStatBar {...props} />);
    const barLengths = wrapper.find(BarStat).map(barStat => {
      return barStat.props().width;
    });
    expect(barLengths[0]).toBeLessThan(barLengths[2]);
    expect(barLengths[2]).toBeLessThan(barLengths[1]);
  });

  it('should place value outside a bar if length is small', () => {
    props.size.w = 300;
    const wrapper = shallow(<MultiStatBar {...props} />);
    expect(wrapper.find(BarStat).get(0).props.valueOutOfBar).toBe(true);
  });

  it('should place value inside a bar if length is large', () => {
    props.size = { w: 900, h: 50 };
    const wrapper = shallow(<MultiStatBar {...props} />);
    expect(wrapper.find(BarStat).get(0).props.valueOutOfBar).toBe(false);
  });

  it('should rotate label for narrow vertical bars', () => {
    props.options.layout = 'horizontal';
    props.size = { w: 150, h: 300 };
    const wrapper = shallow(<MultiStatBar {...props} />);
    expect(wrapper.find(BarStat).get(0).props.verticalLabel).toBe(true);
  });

  it('should leave horizontal label if bar is wide enough', () => {
    props.options.layout = 'horizontal';
    props.size = { w: 900, h: 100 };
    const wrapper = shallow(<MultiStatBar {...props} />);
    expect(wrapper.find(BarStat).get(0).props.verticalLabel).toBe(false);
  });

  it('should autoscale font size', () => {
    let propsA = _.cloneDeep(props);
    let propsB = _.cloneDeep(props);
    propsA.size.h = 200;
    propsB.size.h = 400;
    propsB.size.w = 800;
    const wrapperA = shallow(<MultiStatBar {...propsA} />);
    const wrapperB = shallow(<MultiStatBar {...propsB} />);
    const fontSizeA = wrapperA.find(BarStat).get(0).props.fontSize;
    const fontSizeB = wrapperB.find(BarStat).get(0).props.fontSize;
    expect(fontSizeA).toBeLessThan(fontSizeB);
  });
});

function getColorMock(v: number): string {
  if (v >= 20) {
    return 'rgb(255, 0, 0)';
  } else if (v >= 15) {
    return 'rgb(0, 255, 0)';
  } else {
    return 'rgb(0, 0, 255)';
  }
}
