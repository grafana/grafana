import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { LoaderButton, TextInputField, TextareaInputField } from '@percona/platform-core';
import { StepProgress } from './StepProgress';

xdescribe('StepProgress::', () => {
  const steps = [
    {
      render: () => (
        <div>
          <TextInputField name="name" />
          <TextInputField name="email" />
        </div>
      ),
      fields: ['name', 'email'],
      dataQa: 'step-1',
    },
    {
      render: () => (
        <div>
          <TextareaInputField name="description" />
          <LoaderButton type="submit" />
        </div>
      ),
      fields: ['description'],
      dataQa: 'step-2',
    },
  ];

  const isCurrentStep = (wrapper: ReactWrapper, dataQa: string) =>
    wrapper
      .find(`[data-qa="${dataQa}"]`)
      .find('[data-qa="step-content"]')
      .find('div')
      .at(1)
      .prop('className')
      ?.includes('current');

  it('renders steps correctly', () => {
    const wrapper = mount(<StepProgress steps={steps} submitButtonMessage="Confirm" onSubmit={() => {}} />);

    expect(wrapper.find('input').length).toBe(2);
    expect(wrapper.find('textarea').length).toBe(1);
    expect(wrapper.find('button').length).toBe(2);
    expect(wrapper.find('[data-qa="step-header"]').length).toBe(2);
    expect(isCurrentStep(wrapper, 'step-1')).toBeTruthy();
  });
  it('renders steps correctly with initial values', () => {
    const wrapper = mount(
      <StepProgress
        steps={steps}
        submitButtonMessage="Confirm"
        onSubmit={() => {}}
        initialValues={{
          name: 'Test name',
          description: 'Test description',
        }}
      />
    );

    expect(wrapper.find('input').at(0).prop('value')).toEqual('Test name');
    expect(wrapper.find('textarea').at(0).prop('value')).toEqual('Test description');
  });
  it('changes current step correctly', () => {
    const wrapper = mount(<StepProgress steps={steps} submitButtonMessage="Confirm" onSubmit={() => {}} />);

    expect(isCurrentStep(wrapper, 'step-1')).toBeTruthy();

    wrapper.find('[data-qa="step-2"]').find('[data-qa="step-header"]').simulate('click');

    expect(isCurrentStep(wrapper, 'step-1')).toBeFalsy();
    expect(isCurrentStep(wrapper, 'step-2')).toBeTruthy();
  });
  it('calls submit correctly', () => {
    const onSubmit = jest.fn();
    const wrapper = mount(
      <StepProgress
        steps={steps}
        submitButtonMessage="Confirm"
        onSubmit={onSubmit}
        initialValues={{
          name: 'Test name',
          description: 'Test description',
        }}
      />
    );

    wrapper
      .find('input')
      .at(1)
      .simulate('change', { target: { value: 'test@test.com' } });
    wrapper.find('form').simulate('submit');

    expect(onSubmit).toHaveBeenCalled();
  });
});
