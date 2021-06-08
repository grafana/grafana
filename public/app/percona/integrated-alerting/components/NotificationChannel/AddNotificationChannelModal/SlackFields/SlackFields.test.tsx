import { dataQa } from '@percona/platform-core';
import { mount } from 'enzyme';
import React from 'react';
import { Form } from 'react-final-form';

import { Messages } from '../AddNotificationChannelModal.messages';

import { SlackFields } from './SlackFields';

xdescribe('SlackFields', () => {
  it('should render correct fields', () => {
    const wrapper = mount(<Form onSubmit={jest.fn()} render={() => <SlackFields />} />);

    expect(wrapper.find(dataQa('channel-text-input')).length).toBe(1);
  });

  it('should show error when channel has #', () => {
    const wrapper = mount(<Form onSubmit={jest.fn()} render={() => <SlackFields />} />);

    expect(wrapper.find(dataQa('channel-field-error-message')).text()).toEqual('');

    wrapper.find(dataQa('channel-text-input')).simulate('change', { target: { value: '#testchannel' } });

    expect(wrapper.find(dataQa('channel-field-error-message')).text()).toEqual(Messages.invalidChannelName);
  });
});
