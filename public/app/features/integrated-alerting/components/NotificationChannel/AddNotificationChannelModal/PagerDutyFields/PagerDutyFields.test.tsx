import { dataQa } from '@percona/platform-core';
import { mount } from 'enzyme';
import React from 'react';
import { Form } from 'react-final-form';

import { NotificationChannelType } from '../../NotificationChannel.types';

import { PagerDutyFields } from './PagerDutyFields';

describe('PagerDutyFields', () => {
  it('should render correct fields', () => {
    const values = { name: 'test name', type: { value: NotificationChannelType.pagerDuty, label: 'test label' } };
    const wrapper = mount(<Form onSubmit={jest.fn()} render={() => <PagerDutyFields values={values} />} />);

    expect(wrapper.find(dataQa('routing-text-input')).length).toBe(1);
    expect(wrapper.find(dataQa('service-text-input')).length).toBe(1);
  });
});
