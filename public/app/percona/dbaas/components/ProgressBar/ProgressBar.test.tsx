import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { ProgressBar } from './ProgressBar';
import { ProgressBarStatus } from './ProgressBar.types';

describe('ProgressBar::', () => {
  it('renders with steps, message and width', () => {
    const wrapper = mount(
      <ProgressBar finishedSteps={5} totalSteps={10} status={ProgressBarStatus.progress} message="test message" />
    );
    const steps = wrapper.find(dataQa('progress-bar-steps'));
    const message = wrapper.find(dataQa('progress-bar-message'));
    const content = wrapper.find(dataQa('progress-bar-content')).childAt(0);

    expect(steps.text()).toEqual('5/10');
    expect(message.text()).toEqual('test message');
    expect(content.prop('className').includes('error')).toBeFalsy();
    expect(getComputedStyle(content.getDOMNode()).getPropertyValue('width')).toEqual('50%');
  });

  it('renders without message and rounds float width to nearest integer', () => {
    const wrapper = mount(<ProgressBar finishedSteps={4} totalSteps={7} status={ProgressBarStatus.progress} />);
    const steps = wrapper.find(dataQa('progress-bar-steps'));
    const message = wrapper.find(dataQa('progress-bar-message'));
    const content = wrapper.find(dataQa('progress-bar-content')).childAt(0);

    expect(steps.text()).toEqual('4/7');
    expect(message.text()).toEqual('');
    expect(getComputedStyle(content.getDOMNode()).getPropertyValue('width')).toEqual('57%');
  });

  it('renders with error status', () => {
    const wrapper = mount(
      <ProgressBar finishedSteps={0} totalSteps={1} message="test message" status={ProgressBarStatus.error} />
    );
    const steps = wrapper.find(dataQa('progress-bar-steps'));
    const message = wrapper.find(dataQa('progress-bar-message'));
    const content = wrapper.find(dataQa('progress-bar-content')).childAt(0);

    expect(steps.text()).toEqual('0/1');
    expect(message.text()).toEqual('test message');
    expect(getComputedStyle(content.getDOMNode()).getPropertyValue('width')).toEqual('0%');
    expect(content.prop('className').includes('error')).toBeTruthy();
  });

  it('handles invalid total steps', () => {
    const wrapper = mount(<ProgressBar finishedSteps={5} totalSteps={0} status={ProgressBarStatus.progress} />);
    const content = wrapper.find(dataQa('progress-bar-content')).childAt(0);

    expect(getComputedStyle(content.getDOMNode()).getPropertyValue('width')).toEqual('0%');
  });
});
