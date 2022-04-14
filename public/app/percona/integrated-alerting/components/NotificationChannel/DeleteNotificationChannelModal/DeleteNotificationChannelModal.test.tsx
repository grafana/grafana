import React from 'react';
import { DeleteNotificationChannelModal } from './DeleteNotificationChannelModal';
import { notificationChannelStubs } from '../__mocks__/notificationChannelStubs';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../NotificationChannel.service');
jest.mock('app/core/app_events');

describe('DeleteNotificationChannelModal', () => {
  it('should render delete modal', () => {
    render(
      <DeleteNotificationChannelModal
        notificationChannel={notificationChannelStubs[0]}
        setVisible={jest.fn()}
        isVisible
      />
    );

    expect(screen.getByTestId('confirm-delete-modal-button')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-delete-modal-button')).toBeInTheDocument();
  });

  it('should not render modal when visible is set to false', () => {
    render(
      <DeleteNotificationChannelModal
        notificationChannel={notificationChannelStubs[0]}
        setVisible={jest.fn()}
        isVisible={false}
      />
    );

    expect(screen.queryByTestId('confirm-delete-modal-button')).not.toBeInTheDocument();
  });

  it('should call setVisible on close', () => {
    const setVisible = jest.fn();
    render(
      <DeleteNotificationChannelModal
        notificationChannel={notificationChannelStubs[0]}
        setVisible={setVisible}
        isVisible
      />
    );

    const background = screen.getByTestId('modal-background');
    fireEvent.click(background);

    expect(setVisible).toHaveBeenCalled();
  });
});
