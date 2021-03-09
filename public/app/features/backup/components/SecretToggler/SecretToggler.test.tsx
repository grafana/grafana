import React from 'react';
import { shallow } from 'enzyme';
import { dataQa, TextInputField } from '@percona/platform-core';
import { Icon } from '@grafana/ui';
import { SecretToggler } from './SecretToggler';

describe('SecretToggler', () => {
  it('should render hidden characters by default', () => {
    const wrapper = shallow(<SecretToggler small secret="secret" />);

    expect(wrapper.find(dataQa('small-secret-holder')).text()).toBe('******');
  });

  it('should show the eye icon when not showing text', () => {
    const wrapper = shallow(<SecretToggler secret="secret" />);

    expect(wrapper.find(Icon).prop('name')).toBe('eye');
  });

  it('should reveal the secret when the eye is clicked', () => {
    const wrapper = shallow(<SecretToggler small secret="secret" />);

    wrapper.find(Icon).simulate('click');
    expect(wrapper.find(Icon).prop('name')).toBe('eye-slash');
    expect(wrapper.find(dataQa('small-secret-holder')).text()).toBe('secret');
  });

  it('should show a TextInputField when not small', () => {
    const wrapper = shallow(<SecretToggler secret="secret" />);

    expect(wrapper.find(TextInputField).exists()).toBeTruthy();
  });
});
