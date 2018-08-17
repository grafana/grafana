import React from 'react';
import { shallow } from 'enzyme';

import { BarStat, BarStatProps } from './BarStat';

describe('<BarStat />', () => {
  let props: BarStatProps;

  beforeEach(() => {
    props = {
      direction: 'vertical',
      width: 300,
      height: 50,
      label: 'series_label',
      value: '10%',
      fontSize: 16,
    };
  });

  it('should render label and value', () => {
    const wrapper = shallow(<BarStat {...props} />);
    expect(wrapper.find('.bar-label').text()).toBe('series_label');
    expect(wrapper.find('.bar-value').text()).toBe('10%');
  });

  it('should set proper width and height', () => {
    const wrapper = shallow(<BarStat {...props} />);
    const styles = mapStyles(
      wrapper
        .find('.multistat-bar-container')
        .render()
        .get(0).attribs.style
    );
    expect(styles.width).toBe('300px');
    expect(styles.height).toBe('50px');
  });

  it('should set proper font size', () => {
    const wrapper = shallow(<BarStat {...props} />);
    const styles = mapStyles(
      wrapper
        .find('.bar-label')
        .render()
        .get(0).attribs.style
    );
    expect(styles['font-size']).toBe('16px');
  });

  it('should place value inside a bar by default', () => {
    const wrapper = shallow(<BarStat {...props} />);
    expect(wrapper.find('.value-container.value-container--out-of-bar').exists()).toBe(false);
    expect(wrapper.find('span.bar-value').exists()).toBe(true);
  });

  it('should place value outside a bar if option set', () => {
    props.valueOutOfBar = true;
    const wrapper = shallow(<BarStat {...props} />);
    expect(wrapper.find('.value-container.value-container--out-of-bar').exists()).toBe(true);
  });

  it('should color bar background, border and value', () => {
    props.color = 'rgb(255, 0, 0)';
    props.colorValue = true;
    const wrapper = shallow(<BarStat {...props} />);
    const styles = mapStyles(
      wrapper
        .find('.multistat-bar')
        .render()
        .get(0).attribs.style
    );
    const valueStyles = mapStyles(
      wrapper
        .find('.bar-value')
        .render()
        .get(0).attribs.style
    );
    expect(styles['background']).toBe('rgba(255, 0, 0, 0.3)');
    expect(styles['border-right-color']).toBe('rgb(255, 0, 0)');
    expect(valueStyles['color']).toBe('rgb(255, 0, 0)');
  });
});

/**
 * Converts style string to map
 * "width:100px;height:50px" => { width: '100px', height: '50px' }
 * @param style CSS style string ("width:100px;height:50px")
 */
function mapStyles(style: string): any {
  let styleMap = {};
  const styles = style.split(';');
  styles.forEach(s => {
    const [key, value] = s.split(':');
    styleMap[key] = value;
  });
  return styleMap;
}
