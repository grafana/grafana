import React from 'react';
import { NotificationChannelActions } from './NotificationChannelActions';
import { notificationChannelStubs, notificationChannelContextStub } from '../__mocks__/notificationChannelStubs';
import { NotificationChannelProvider } from '../NotificationChannel.provider';
import { render, screen, fireEvent } from '@testing-library/react';

describe('NotificationChannelActions', () => {
  it('should render all the actions', () => {
    render(<NotificationChannelActions notificationChannel={notificationChannelStubs[0]} />);

    expect(screen.getByTestId('edit-notification-channel-button')).toBeInTheDocument();
  });

  it('should open edit modal when clicking edit button', () => {
    render(
      <NotificationChannelProvider.Provider value={notificationChannelContextStub}>
        <NotificationChannelActions notificationChannel={notificationChannelStubs[0]} />
      </NotificationChannelProvider.Provider>
    );

    const button = screen.getByTestId('edit-notification-channel-button');
    fireEvent.click(button);

    expect(notificationChannelContextStub.setSelectedNotificationChannel).toHaveBeenCalled();
    expect(notificationChannelContextStub.setAddModalVisible).toHaveBeenCalled();
  });

  it('should open delete modal when clicking edit button', () => {
    render(
      <NotificationChannelProvider.Provider value={notificationChannelContextStub}>
        <NotificationChannelActions notificationChannel={notificationChannelStubs[0]} />
      </NotificationChannelProvider.Provider>
    );

    const button = screen.getByTestId('delete-notification-channel-button');
    fireEvent.click(button);

    expect(notificationChannelContextStub.setSelectedNotificationChannel).toHaveBeenCalled();
    expect(notificationChannelContextStub.setDeleteModalVisible).toHaveBeenCalled();
  });
});
