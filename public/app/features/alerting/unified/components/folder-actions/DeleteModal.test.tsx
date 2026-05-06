import { type UserEvent } from '@testing-library/user-event';
import { render, screen, waitFor } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';

import { DeleteModal, type Props } from './DeleteModal';

const mockTrackSuccess = jest.fn();
const mockTrackFail = jest.fn();
jest.mock('../../Analytics', () => ({
  trackFolderBulkActionsDeleteSuccess: () => mockTrackSuccess(),
  trackFolderBulkActionsDeleteFail: () => mockTrackFail(),
}));

const defaultProps: Props = {
  isOpen: true,
  folderName: 'My folder',
  onConfirm: jest.fn(),
  onDismiss: jest.fn(),
};

const renderModal = (props: Partial<Props> = {}) => {
  const view = render(
    <>
      <AppNotificationList />
      <DeleteModal {...defaultProps} {...props} />
    </>
  );
  return view;
};

const confirmDelete = async (user: UserEvent) => {
  await user.type(screen.getByTestId(selectors.pages.ConfirmModal.input), 'Delete');
  await user.click(screen.getByTestId(selectors.pages.ConfirmModal.delete));
};

describe('DeleteModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an error notification, dismisses, and tracks failure when onConfirm rejects', async () => {
    const onConfirm = jest.fn().mockRejectedValue(new Error('cannot delete'));
    const onDismiss = jest.fn();
    const { user } = renderModal({ onConfirm, onDismiss });

    await confirmDelete(user);

    expect(await screen.findByText(/Failed to delete folder rules/i)).toBeInTheDocument();
    expect(await screen.findByText(/cannot delete/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(mockTrackFail).toHaveBeenCalledTimes(1);
    });
    expect(mockTrackSuccess).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses and tracks success when onConfirm resolves', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    const onDismiss = jest.fn();
    const { user } = renderModal({ onConfirm, onDismiss });

    await confirmDelete(user);

    await waitFor(() => {
      expect(mockTrackSuccess).toHaveBeenCalledTimes(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockTrackFail).not.toHaveBeenCalled();
    expect(screen.queryByText(/Failed to delete folder rules/i)).not.toBeInTheDocument();
  });
});
