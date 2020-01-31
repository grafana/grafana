import React from 'react';
import { shallow, mount, ReactWrapper } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { SignupForm } from './SignupForm';
import { SignupCtrlState } from './SignupCtrl';

describe('SignupForm', () => {
  describe('With different values for verifyEmail and autoAssignOrg', () => {
    it('should render input fields', () => {
      const wrapper = shallow(<SignupForm onSubmit={() => {}} verifyEmailEnabled={true} autoAssignOrg={false} />);
      expect(wrapper.exists('Forms.Input[name="orgName"]'));
      expect(wrapper.exists('Forms.Input[name="code"]'));
    });
    it('should not render input fields', () => {
      const wrapper = shallow(<SignupForm onSubmit={() => {}} verifyEmailEnabled={false} autoAssignOrg={true} />);
      expect(wrapper.exists('Forms.Input[name="orgName"]')).toBeFalsy();
      expect(wrapper.exists('Forms.Input[name="code"]')).toBeFalsy();
    });
  });

  describe('handling form submission', () => {
    let submit = jest.fn();
    let wrapper: ReactWrapper;

    const submitScenario = async (description: string, defaults: Partial<SignupCtrlState>, fn: (cd: any) => any) => {
      defaults.verifyEmailEnabled = true;
      defaults.autoAssignOrg = false;
      submit = jest.fn();
      await act(async () => {
        wrapper = mount(
          <SignupForm
            defaultValues={defaults as SignupCtrlState}
            onSubmit={submit}
            verifyEmailEnabled={true}
            autoAssignOrg={false}
          />
        );
      });
      //   console.log(wrapper.debug());
      await act(async () => {
        //     wrapper.find('Form').simulate('submit');
        //   });

        wrapper.find('Form').simulate('submit');

        it(description, fn);
      });
    };

    submitScenario('should submit form properly', { email: 'test@email.com', password: 'supersecret12343' }, () => {
      expect(submit).toHaveBeenCalledWith({ email: 'test@email.com', password: 'supersecret12343' });
    });

    submitScenario(
      'should not be submitted with faulty email',
      { email: 'testemail.com', password: 'supersecret12343' },
      () => {
        expect(submit).not.toHaveBeenCalled();
      }
    );

    it('should not be submitted on faulty email', () => {});

    it('email required', () => {});

    it('password required', () => {});
  });
});
