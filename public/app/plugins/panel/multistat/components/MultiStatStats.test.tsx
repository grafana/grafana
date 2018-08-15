import React from 'react';
import { shallow } from 'enzyme';

import { MultiStatStats, MultiStatStatsProps } from './MultiStatStats';
import { SingleStat } from './SingleStat';

describe('<MultiStatStats />', () => {
  let props: MultiStatStatsProps;

  beforeEach(() => {
    props = {
      stats: [
        { label: 'series_1', value: 10, valueFormatted: '10%', flotpairs: [[1000, 10], [2000, 10]] },
        { label: 'series_2', value: 20, valueFormatted: '20%', flotpairs: [[1000, 20], [2000, 20]] },
        { label: 'series_3', value: 15, valueFormatted: '15%', flotpairs: [[1000, 15], [2000, 15]] },
      ],
      size: { w: 600, h: 150 },
      options: {
        layout: 'horizontal',
        colorValue: true,
        sparkline: { show: false },
      },
      getColor: getColorMock,
    };
  });

  it('should basically render component', () => {
    const wrapper = shallow(<MultiStatStats {...props} />);
    expect(wrapper.find(SingleStat)).toHaveLength(3);
    expect(wrapper.find(SingleStat).get(0).props.height).toBe(150);
    expect(wrapper.find(SingleStat).get(0).props.width).toBe(200);
  });

  it('should properly render vertical layout', () => {
    props.options.layout = 'vertical';
    const wrapper = shallow(<MultiStatStats {...props} />);
    expect(wrapper.find(SingleStat)).toHaveLength(3);
    // (panel height - panel padding) / number of elements
    expect(wrapper.find(SingleStat).get(0).props.height).toBe(40);
    expect(wrapper.find(SingleStat).get(0).props.width).toBe(600);
  });

  it('should set colors for values', () => {
    const wrapper = shallow(<MultiStatStats {...props} />);
    expect(wrapper.find(SingleStat).get(0).props.color).toBe('rgb(0, 0, 255)');
    expect(wrapper.find(SingleStat).get(1).props.color).toBe('rgb(255, 0, 0)');
    expect(wrapper.find(SingleStat).get(2).props.color).toBe('rgb(0, 255, 0)');
  });

  it('should render sparkline if option set', () => {
    props.options.sparkline.show = true;
    const wrapper = shallow(<MultiStatStats {...props} />);
    expect(wrapper.find(SingleStat).get(0).props.sparkline.show).toBe(true);
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
