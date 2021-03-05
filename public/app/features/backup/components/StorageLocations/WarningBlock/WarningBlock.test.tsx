import React from 'react';
import { shallow } from 'enzyme';
import { Icon } from '@grafana/ui';
import { WarningBlock } from './WarningBlock';

describe('WarningBlock', () => {
  it('should have warning icon and message', () => {
    const wrapper = shallow(<WarningBlock message="message" />);
    expect(wrapper.find(Icon).prop('name')).toBe('info-circle');
    expect(wrapper.text()).toBe('message');
  });

  it('should change icon', () => {
    const wrapper = shallow(<WarningBlock message="message" type="warning" />);
    expect(wrapper.find(Icon).prop('name')).toBe('exclamation-triangle');
  });
});
