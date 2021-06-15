import React from 'react';
import { mount } from 'enzyme';
import { Field } from 'react-final-form';
import { dataQa, FormWrapper } from '@percona/platform-core';
import { SwitchField } from './Switch';

describe('SwitchField::', () => {
  it('should render an input element of type checkbox', () => {
    const wrapper = mount(
      <FormWrapper>
        <SwitchField name="test" />
      </FormWrapper>
    );

    const field = wrapper.find(Field);

    expect(field).toHaveLength(1);
    expect(wrapper.find('input')).toHaveLength(1);
    expect(wrapper.find('input').props()).toHaveProperty('type', 'checkbox');
  });

  it('should call passed validators', () => {
    const validatorOne = jest.fn();
    const validatorTwo = jest.fn();

    mount(
      <FormWrapper>
        <SwitchField name="test" validators={[validatorOne, validatorTwo]} />
      </FormWrapper>
    );

    expect(validatorOne).toBeCalledTimes(1);
    expect(validatorTwo).toBeCalledTimes(1);
  });

  it('should show no labels if one is not specified', () => {
    const wrapper = mount(
      <FormWrapper>
        <SwitchField name="test" />
      </FormWrapper>
    );

    expect(wrapper.find(dataQa('test-field-label')).length).toBe(0);
  });

  it('should show a label if one is specified', () => {
    const wrapper = mount(
      <FormWrapper>
        <SwitchField label="test label" name="test" />
      </FormWrapper>
    );

    expect(wrapper.find(dataQa('test-field-label')).length).toBe(1);
    expect(wrapper.find(dataQa('test-field-label')).text()).toBe('test label');
  });

  it('should change the state value when clicked', () => {
    const wrapper = mount(
      <FormWrapper>
        <SwitchField name="test" />
      </FormWrapper>
    );

    expect(
      wrapper
        .find(dataQa('test-switch'))
        .at(0)
        .props()
    ).toHaveProperty('value', false);
    wrapper.find('input').simulate('change', { target: { value: true } });
    wrapper.update();

    expect(
      wrapper
        .find(dataQa('test-switch'))
        .at(0)
        .props()
    ).toHaveProperty('value', true);
  });

  it('should disable switch when `disabled` is passed via props', () => {
    const wrapper = mount(
      <FormWrapper>
        <SwitchField name="test" disabled />
      </FormWrapper>
    );

    expect(wrapper.find('input').props()).toHaveProperty('disabled', true);
  });
});
