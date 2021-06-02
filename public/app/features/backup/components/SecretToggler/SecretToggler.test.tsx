import React from 'react';
import { shallow } from 'enzyme';
import { TextInputField } from '@percona/platform-core';
import { Icon } from '@grafana/ui';
import { SecretToggler } from './SecretToggler';

describe('SecretToggler', () => {
  it('should render hidden characters by default', () => {
    const wrapper = shallow(<SecretToggler small secret="secret" />);

    expect(wrapper.find('input').prop('type')).toBe('password');
  });

  it('should show the eye icon when not showing text', () => {
    const wrapper = shallow(<SecretToggler secret="secret" />);

    expect(wrapper.find(Icon).prop('name')).toBe('eye');
  });

  it('should reveal the secret when the eye is clicked', () => {
    const wrapper = shallow(<SecretToggler small secret="secret" />);

    wrapper.find(Icon).simulate('click');
    expect(wrapper.find(Icon).prop('name')).toBe('eye-slash');
    expect(wrapper.find('input').prop('type')).toBe('text');
  });

  it('should have the input as read only by default', () => {
    const wrapper = shallow(<SecretToggler small secret="secret" />);

    expect(wrapper.find('input').prop('readOnly')).toBeTruthy();
  });

  it('should show a TextInputField when not small', () => {
    const wrapper = shallow(<SecretToggler secret="secret" />);

    expect(wrapper.find(TextInputField).exists()).toBeTruthy();
  });
});
