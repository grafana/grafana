import React from 'react';
import { mount } from 'enzyme';
import { RetryModeSelector } from './RetryModeSelector';
import { FormWrapper, NumberInputField, RadioButtonGroupField } from '@percona/platform-core';
import { RetryMode } from 'app/percona/backup/Backup.types';

describe('RetryModeSelector', () => {
  it('should render', () => {
    const wrapper = mount(
      <FormWrapper>
        <RetryModeSelector retryMode={RetryMode.AUTO} />
      </FormWrapper>
    );
    expect(wrapper.find(RadioButtonGroupField)).toHaveLength(1);
    expect(wrapper.find(NumberInputField)).toHaveLength(2);
    expect(wrapper.find(NumberInputField).at(0).prop('disabled')).toBeFalsy();
  });

  it('should disable number inputs when retry mode is MANUAL', () => {
    const wrapper = mount(
      <FormWrapper>
        <RetryModeSelector retryMode={RetryMode.MANUAL} />
      </FormWrapper>
    );
    expect(wrapper.find(NumberInputField).at(0).prop('disabled')).toBeTruthy();
  });

  it('should disable all fields when disabled is passed, even if retry mode is AUTO', () => {
    const wrapper = mount(
      <FormWrapper>
        <RetryModeSelector disabled retryMode={RetryMode.AUTO} />
      </FormWrapper>
    );
    expect(wrapper.find(RadioButtonGroupField).at(0).prop('disabled')).toBeTruthy();
    expect(wrapper.find(NumberInputField).at(0).prop('disabled')).toBeTruthy();
  });
});
