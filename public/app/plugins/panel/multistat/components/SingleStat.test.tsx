import React from 'react';
import { shallow } from 'enzyme';

import { SingleStat, SingleStatProps } from './SingleStat';
import { SparkLine } from './SparkLine';

describe('<SingleStat />', () => {
  let props: SingleStatProps;

  beforeEach(() => {
    props = {
      layout: 'horizontal',
      width: 500,
      height: 200,
      label: 'label',
      value: '42',
      sparkline: {
        show: false,
      },
    };
  });

  it('should basically render label and value', () => {
    const wrapper = shallow(<SingleStat {...props} />);
    expect(wrapper.find('.multistat-label').text()).toBe('label');
    expect(wrapper.find('.multistat-value').text()).toBe('42');
    expect(wrapper.find('.multistat-single').hasClass('label-left')).toBe(false);
    expect(wrapper.find(SparkLine)).toHaveLength(0);
  });

  it('should render sparkline if option set', () => {
    props.sparkline.show = true;
    const wrapper = shallow(<SingleStat {...props} />);
    expect(wrapper.find(SparkLine)).toHaveLength(1);
  });

  it('should place label and value at the same line if option set', () => {
    props.labelToTheLeft = true;
    const wrapper = shallow(<SingleStat {...props} />);
    expect(wrapper.find('.multistat-single').hasClass('label-left')).toBe(true);
  });
});
