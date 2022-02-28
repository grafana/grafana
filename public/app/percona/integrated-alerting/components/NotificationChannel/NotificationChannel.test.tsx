import React from 'react';
import { NotificationChannel } from './NotificationChannel';
import { DeleteNotificationChannelModal } from './DeleteNotificationChannelModal/DeleteNotificationChannelModal';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('./NotificationChannel.service');
jest.mock('./DeleteNotificationChannelModal/DeleteNotificationChannelModal', () => ({
  DeleteNotificationChannelModal: jest.fn(({ children }) => (
    <div data-testid="DeleteNotificationChannelModal">{children}</div>
  )),
}));

describe('NotificationChannel', () => {
  it('should render table correctly', async () => {
    render(<NotificationChannel />);

    expect((await screen.findByTestId('table-thead')).querySelectorAll('tr')).toHaveLength(1);
    expect((await screen.findByTestId('table-tbody')).querySelectorAll('tr')).toHaveLength(3);
    expect(screen.queryAllByTestId('table-no-data')).toHaveLength(0);
  });

  it('should render add modal', async () => {
    render(<NotificationChannel />);

    expect(await waitFor(() => screen.queryByTestId('modal-wrapper'))).toBeFalsy();

    const button = screen.getByTestId('notification-channel-add-modal-button');
    fireEvent.click(button);

    expect(screen.getByTestId('modal-wrapper')).toBeInTheDocument();
  });

  it('should render delete modal', async () => {
    await waitFor(() => render(<NotificationChannel />));

    expect(DeleteNotificationChannelModal).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: false }),
      expect.anything()
    );
  });
});
