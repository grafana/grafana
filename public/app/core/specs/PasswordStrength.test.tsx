import React from 'react';
import { shallow } from 'enzyme';

import { PasswordStrength } from '../components/PasswordStrength';

describe('PasswordStrength', () => {
  describe('Using length', () => {
    it('should have class bad if using weak password', () => {
      const wrapper = shallow(<PasswordStrength password="asd" />);
      expect(wrapper.find('.password-strength-bad')).toHaveLength(1);
    });

    it('should have class ok if using average password', () => {
      const wrapper = shallow(<PasswordStrength password="asdasd" />);
      expect(wrapper.find('.password-strength-ok')).toHaveLength(1);
    });

    it('should have class good if using strong password or passphrase', () => {
      const wrapper = shallow(<PasswordStrength password="asdaasdda" />);
      expect(wrapper.find('.password-strength-good')).toHaveLength(1);
    });
  });

  describe('Using zxcvbn', () => {
    // zxcvbn is dynamically imported due to its size
    // wait for the dynamic import to resolve
    const waitForPromises = () => new Promise(resolve => process.nextTick(resolve));

    it('should have class bad if using weak password', async () => {
      const wrapper = shallow(<PasswordStrength password="aaaaaaa" />);
      await waitForPromises();

      expect(wrapper.find('.password-strength-bad')).toHaveLength(1);
    });

    it('should have class ok if using average password', async () => {
      const wrapper = shallow(<PasswordStrength password="ok-password2" />);
      await waitForPromises();

      expect(wrapper.find('.password-strength-ok')).toHaveLength(1);
    });

    it('should have class good if using strong password or passphrase', async () => {
      const wrapper = shallow(<PasswordStrength password="grape-acoustic-feature-abuse-gaze" />);
      await waitForPromises();

      expect(wrapper.find('.password-strength-good')).toHaveLength(1);
    });
  });
});
