import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { NotificationChannelActions } from './NotificationChannelActions';
import { notificationChannelStubs, notificationChannelContextStub } from '../__mocks__/notificationChannelStubs';
import { NotificationChannelProvider } from '../NotificationChannel.provider';

describe('NotificationChannelActions', () => {
  it('should render all the actions', () => {
    const wrapper = mount(<NotificationChannelActions notificationChannel={notificationChannelStubs[0]} />);

    expect(wrapper.find(dataQa('edit-notification-channel-button'))).toBeTruthy();
  });

  it('should open edit modal when clicking edit button', () => {
    const wrapper = mount(
      <NotificationChannelProvider.Provider value={notificationChannelContextStub}>
        <NotificationChannelActions notificationChannel={notificationChannelStubs[0]} />
      </NotificationChannelProvider.Provider>
    );

    wrapper
      .find(dataQa('edit-notification-channel-button'))
      .find('button')
      .simulate('click');

    expect(notificationChannelContextStub.setSelectedNotificationChannel).toHaveBeenCalled();
    expect(notificationChannelContextStub.setAddModalVisible).toHaveBeenCalled();
  });

  it('should open delete modal when clicking edit button', () => {
    const wrapper = mount(
      <NotificationChannelProvider.Provider value={notificationChannelContextStub}>
        <NotificationChannelActions notificationChannel={notificationChannelStubs[0]} />
      </NotificationChannelProvider.Provider>
    );

    wrapper
      .find(dataQa('delete-notification-channel-button'))
      .find('button')
      .simulate('click');

    expect(notificationChannelContextStub.setSelectedNotificationChannel).toHaveBeenCalled();
    expect(notificationChannelContextStub.setDeleteModalVisible).toHaveBeenCalled();
  });
});
