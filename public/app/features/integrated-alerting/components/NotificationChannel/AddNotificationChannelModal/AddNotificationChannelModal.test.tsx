import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { dataQa } from '@percona/platform-core';
import { AddNotificationChannelModal } from './AddNotificationChannelModal';
import { TYPE_OPTIONS } from './AddNotificationChannel.constants';
import { notificationChannelStubs } from '../__mocks__/notificationChannelStubs';

jest.mock('../NotificationChannel.service');
jest.mock('app/core/app_events');

describe('AddNotificationChannelModal', () => {
  it('should render modal with correct fields', () => {
    const wrapper = mount(<AddNotificationChannelModal setVisible={jest.fn()} isVisible />);

    expect(wrapper.find('[className$="-singleValue"]').text()).toEqual(TYPE_OPTIONS[0].label);
    expect(wrapper.find('input').length).toBe(2);
    expect(wrapper.find(dataQa('emails-textarea-input')).length).toBe(1);
    expect(wrapper.find(dataQa('notification-channel-add-button')).find('button').length).toBe(1);
    expect(wrapper.find(dataQa('notification-channel-cancel-button')).find('button').length).toBe(1);
  });

  it('should not render modal when visible is set to false', () => {
    const wrapper = mount(<AddNotificationChannelModal setVisible={jest.fn()} isVisible={false} />);

    expect(wrapper.find(dataQa('emails-textarea-input')).length).toBe(0);
  });

  it('should call setVisible on close', () => {
    const setVisible = jest.fn();
    const wrapper = mount(<AddNotificationChannelModal setVisible={setVisible} isVisible />);

    wrapper.find(dataQa('modal-background')).simulate('click');

    expect(setVisible).toHaveBeenCalled();
  });

  it('should call setVisible on submit', async () => {
    const setVisible = jest.fn();
    const wrapper = mount(<AddNotificationChannelModal setVisible={setVisible} isVisible />);

    wrapper.find(dataQa('name-text-input')).simulate('change', { target: { value: 'Email test' } });
    wrapper.find('textarea').simulate('change', { target: { value: 'test1@percona.com' } });

    await act(async () => {
      wrapper.find('form').simulate('submit');
    });

    expect(setVisible).toHaveBeenCalledWith(false);
  });

  it('should render with notification channel', async () => {
    const setVisible = jest.fn();
    const wrapper = mount(
      <AddNotificationChannelModal
        notificationChannel={notificationChannelStubs[0]}
        setVisible={setVisible}
        isVisible
      />
    );

    expect(wrapper.find(dataQa('name-text-input')).prop('value')).toEqual(notificationChannelStubs[0].summary);
  });
});
