import React from 'react';
import { mount } from 'enzyme';
import { Form } from 'react-final-form';
import { dataQa } from '@percona/platform-core';
import { PagerDutyFields } from './PagerDutyFields';
import { NotificationChannelType, PagerDutyKeyType } from '../../NotificationChannel.types';

describe('PagerDutyFields', () => {
  it('should render with routing as the default key option', () => {
    const values = { name: 'test name', type: { value: NotificationChannelType.pagerDuty, label: 'test label' } };
    const wrapper = mount(<Form onSubmit={jest.fn()} render={() => <PagerDutyFields values={values} />} />);

    expect(wrapper.find(dataQa('keyType-radio-button')).length).toBe(2);
    expect(wrapper.find(dataQa('routing-text-input')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('service-text-input')).exists()).toBeFalsy();
  });

  it('should render only service key input if that is the selected option', () => {
    const values = {
      name: 'test name',
      type: { value: NotificationChannelType.pagerDuty, label: 'test label' },
      keyType: PagerDutyKeyType.service,
    };
    const wrapper = mount(<Form onSubmit={jest.fn()} render={() => <PagerDutyFields values={values} />} />);
    const keyTypeRadioButtons = wrapper.find(dataQa('keyType-radio-button'));
    const serviceKeyTypeButton = keyTypeRadioButtons.at(1);

    expect(serviceKeyTypeButton.props().checked).toBeTruthy();
    expect(wrapper.find(dataQa('service-text-input')).exists()).toBeTruthy();
  });
});
