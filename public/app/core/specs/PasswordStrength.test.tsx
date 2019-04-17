import React from 'react';
import { shallow } from 'enzyme';

import { PasswordStrength } from '../components/PasswordStrength';

describe('PasswordStrength', () => {
  it('should have class bad if using weak password', () => {
    const wrapper = shallow(<PasswordStrength password="aaaaaaa" />);
    expect(wrapper.find('.password-strength-bad')).toHaveLength(1);
  });

  it('should have class ok if using average password', () => {
    const wrapper = shallow(<PasswordStrength password="ok-password2" />);
    expect(wrapper.find('.password-strength-ok')).toHaveLength(1);
  });

  it('should have class good if using strong password or passphrase', () => {
    const wrapper = shallow(<PasswordStrength password="grape-acoustic-feature-abuse-gaze" />);
    expect(wrapper.find('.password-strength-good')).toHaveLength(1);
  });
});
