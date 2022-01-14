import React from 'react';
import { shallow, mount } from 'enzyme';
import { Tooltip } from '@grafana/ui';
import { DBIcon } from './DBIcon';
import { DBIconType } from './DBIcon.types';
import { Edit } from './assets';

describe('DBIcon', () => {
  it('should not display unknown icons', () => {
    const wrapper = shallow(<DBIcon type={'unknown' as DBIconType} />);
    expect(wrapper.children()).toHaveLength(0);
  });

  it('should display known icons', () => {
    const wrapper = shallow(<DBIcon type="edit" />);
    expect(wrapper.find(Edit).exists()).toBeTruthy();
  });

  it('should have 22 x 22 icons by default', () => {
    const wrapper = mount(<DBIcon type="edit" />);
    expect(wrapper.find('svg').prop('width')).toBe(22);
    expect(wrapper.find('svg').prop('height')).toBe(22);
  });

  it('should change icon size', () => {
    const wrapper = mount(<DBIcon size={30} type="edit" />);
    expect(wrapper.find('svg').prop('width')).toBe(30);
    expect(wrapper.find('svg').prop('height')).toBe(30);
  });

  it('should now show tooltip if no text is passed', () => {
    const wrapper = shallow(<DBIcon size={30} type="edit" />);
    expect(wrapper.find(Tooltip).exists()).toBeFalsy();
  });

  it('should show tooltip if text is passed', () => {
    const wrapper = shallow(<DBIcon size={30} type="edit" tooltipText="helper text" />);
    expect(wrapper.find(Tooltip).exists()).toBeTruthy();
  });
});
