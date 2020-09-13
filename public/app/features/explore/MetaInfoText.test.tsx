import React from 'react';
import { shallow, render } from 'enzyme';
import { MetaInfoText, MetaItemProps } from './MetaInfoText';
describe('MetaInfoText', () => {
  it('should render component', () => {
    const items: MetaItemProps[] = [
      { label: 'label', value: 'value' },
      { label: 'label2', value: 'value2' },
    ];
    const wrapper = shallow(<MetaInfoText metaItems={items} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('should render items', () => {
    const items: MetaItemProps[] = [
      { label: 'label', value: 'value' },
      { label: 'label2', value: 'value2' },
    ];

    const wrapper = render(<MetaInfoText metaItems={items} />);
    expect(wrapper.find('label')).toBeTruthy();
    expect(wrapper.find('value')).toBeTruthy();
    expect(wrapper.find('label2')).toBeTruthy();
    expect(wrapper.find('value2')).toBeTruthy();
  });

  it('should render no items when the array is empty', () => {
    const items: MetaItemProps[] = [];

    const wrapper = shallow(<MetaInfoText metaItems={items} />);
    expect(wrapper.find('div').exists()).toBeTruthy();
    expect(wrapper.find('div').children()).toHaveLength(0);
  });
});
