import React from 'react';
import { shallow } from 'enzyme';
import { SignupForm } from './SignupForm';

describe('SignupForm', () => {
  describe('With different values for verifyEmail and autoAssignOrg', () => {
    it('should render input fields', () => {
      const wrapper = shallow(<SignupForm verifyEmailEnabled={true} autoAssignOrg={false} />);
      expect(wrapper.exists('Forms.Input[name="orgName"]'));
      expect(wrapper.exists('Forms.Input[name="code"]'));
    });
    it('should not render input fields', () => {
      const wrapper = shallow(<SignupForm verifyEmailEnabled={false} autoAssignOrg={true} />);
      expect(wrapper.exists('Forms.Input[name="orgName"]')).toBeFalsy();
      expect(wrapper.exists('Forms.Input[name="code"]')).toBeFalsy();
    });
  });
});
