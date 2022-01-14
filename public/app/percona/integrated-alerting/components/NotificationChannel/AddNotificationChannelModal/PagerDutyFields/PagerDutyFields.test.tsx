import React from 'react';
import { mount } from 'enzyme';
import { Form } from 'react-final-form';
import { dataTestId } from '@percona/platform-core';
import { PagerDutyFields } from './PagerDutyFields';
import { NotificationChannelType, PagerDutyKeyType } from '../../NotificationChannel.types';

xdescribe('PagerDutyFields', () => {
  it('should render with routing as the default key option', () => {
    const values = { name: 'test name', type: { value: NotificationChannelType.pagerDuty, label: 'test label' } };
    const wrapper = mount(<Form onSubmit={jest.fn()} render={() => <PagerDutyFields values={values} />} />);

    expect(wrapper.find(dataTestId('keyType-radio-button')).length).toBe(2);
    expect(wrapper.find(dataTestId('routing-text-input')).exists()).toBeTruthy();
    expect(wrapper.find(dataTestId('service-text-input')).exists()).toBeFalsy();
  });

  it('should render only service key input if that is the selected option', () => {
    const values = {
      name: 'test name',
      type: { value: NotificationChannelType.pagerDuty, label: 'test label' },
      keyType: PagerDutyKeyType.service,
    };
    const wrapper = mount(<Form onSubmit={jest.fn()} render={() => <PagerDutyFields values={values} />} />);
    const keyTypeRadioButtons = wrapper.find(dataTestId('keyType-radio-button'));
    const serviceKeyTypeButton = keyTypeRadioButtons.at(1);

    expect(serviceKeyTypeButton.props().checked).toBeTruthy();
    expect(wrapper.find(dataTestId('service-text-input')).exists()).toBeTruthy();
  });
});
