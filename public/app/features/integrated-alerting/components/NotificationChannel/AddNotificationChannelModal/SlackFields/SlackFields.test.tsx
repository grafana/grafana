import React from 'react';
import { mount } from 'enzyme';
import { Form } from 'react-final-form';
import { dataQa } from '@percona/platform-core';
import { SlackFields } from './SlackFields';
import { Messages } from '../AddNotificationChannelModal.messages';

describe('SlackFields', () => {
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
