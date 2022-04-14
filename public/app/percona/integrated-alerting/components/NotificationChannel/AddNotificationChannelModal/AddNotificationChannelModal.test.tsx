import React from 'react';
import { AddNotificationChannelModal } from './AddNotificationChannelModal';
import { TYPE_OPTIONS } from './AddNotificationChannel.constants';
import { notificationChannelStubs } from '../__mocks__/notificationChannelStubs';
import { NotificationChannelProvider } from '../NotificationChannel.provider';
import { NotificationChannelType, PagerDutyKeyType, PagerDutylNotificationChannel } from '../NotificationChannel.types';
import { NotificationChannelService } from '../NotificationChannel.service';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../NotificationChannel.service');
jest.mock('app/core/core', () => ({
  appEvents: {
    emit: jest.fn(),
  },
}));
const withContext = (wrapper: JSX.Element) => (
  <NotificationChannelProvider.Provider
    value={{
      getNotificationChannels: jest.fn(),
      setSelectedNotificationChannel: jest.fn(),
      setAddModalVisible: jest.fn(),
      setDeleteModalVisible: jest.fn(),
    }}
  >
    {wrapper}
  </NotificationChannelProvider.Provider>
);

describe('AddNotificationChannelModal', () => {
  it('should render modal with correct fields', async () => {
    render(withContext(<AddNotificationChannelModal setVisible={jest.fn()} isVisible />));

    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getByTestId('notification-channel-add-button')).toBeInTheDocument();
    expect(screen.getByTestId('notification-channel-cancel-button')).toBeInTheDocument();
  });

  it('should not render modal when visible is set to false', async () => {
    render(withContext(<AddNotificationChannelModal setVisible={jest.fn()} isVisible={false} />));
    expect(screen.queryByTestId('add-notification-channel-modal-form')).not.toBeInTheDocument();
  });

  it('should call setVisible on close', async () => {
    const setVisible = jest.fn();
    render(withContext(<AddNotificationChannelModal setVisible={setVisible} isVisible />));

    const modalBackground = screen.getByTestId('modal-background');
    fireEvent.click(modalBackground);

    expect(setVisible).toHaveBeenCalled();
  });

  it('should call setVisible on submit', async () => {
    const setVisible = jest.fn();
    render(withContext(<AddNotificationChannelModal setVisible={setVisible} isVisible />));

    const nameTextInput = screen.getByTestId('name-text-input');
    fireEvent.change(nameTextInput, { target: { value: 'Email test' } });

    const form = screen.getByTestId('add-notification-channel-modal-form');
    await waitFor(() => fireEvent.submit(form));

    expect(setVisible).toHaveBeenCalledWith(false);
  });

  it('should render with notification channel', async () => {
    const setVisible = jest.fn();
    render(
      withContext(
        <AddNotificationChannelModal
          notificationChannel={notificationChannelStubs[0]}
          setVisible={setVisible}
          isVisible
        />
      )
    );

    expect(screen.getByTestId('name-text-input')).toHaveValue(notificationChannelStubs[0].summary);
  });

  it('should have the submit button initially disabled', async () => {
    render(withContext(<AddNotificationChannelModal setVisible={jest.fn()} isVisible />));
    const button = screen.getByTestId('notification-channel-add-button');

    expect(button).toBeDisabled();
  });

  describe('Pager Duty option', () => {
    const ORIGINAL_ROUTING_KEY = 'example_key';
    const channel: PagerDutylNotificationChannel = {
      type: NotificationChannelType.pagerDuty,
      channelId: 'id1',
      summary: 'name',
      disabled: false,
      sendResolved: false,
      routingKey: ORIGINAL_ROUTING_KEY,
      serviceKey: '',
    };

    it('should only send one of the keys', async () => {
      const serviceAddMock = jest.fn();
      spyOn(NotificationChannelService, 'change').and.callFake(serviceAddMock);

      render(
        withContext(<AddNotificationChannelModal setVisible={jest.fn()} isVisible notificationChannel={channel} />)
      );

      const keyTypeRadioButton = screen.getAllByTestId('keyType-radio-button')[1];
      fireEvent.click(keyTypeRadioButton);

      const serviceTextInput = screen.getByTestId('service-text-input');
      fireEvent.change(serviceTextInput, { target: { value: 'new_service_key' } });

      const form = screen.getByTestId('add-notification-channel-modal-form');
      await waitFor(() => fireEvent.submit(form));

      expect(serviceAddMock).toHaveBeenCalledWith('id1', {
        name: 'name',
        type: TYPE_OPTIONS[1],
        routing: '',
        service: 'new_service_key',
        keyType: PagerDutyKeyType.service,
      });
    });
  });
});
