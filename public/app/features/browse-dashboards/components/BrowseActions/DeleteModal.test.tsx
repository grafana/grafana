import { act, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures, setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { useOfferFolderMove } from '../../utils/useOfferFolderMove';

import { CascadeDeleteWaiter } from './CascadeDeleteWaiter';
import { DeleteModal, type Props } from './DeleteModal';

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

const [_, { folderA }] = getFolderFixtures();

setBackendSrv(backendSrv);
setupMockServer();

// The waiter's own polling behaviour is covered by CascadeDeleteWaiter.test.tsx -- here it's
// stubbed out so tests can settle it directly and assert on how DeleteModal reacts.
jest.mock('./CascadeDeleteWaiter', () => ({
  CascadeDeleteWaiter: jest.fn(),
}));

jest.mock('../../utils/useOfferFolderMove', () => ({
  useOfferFolderMove: jest.fn(),
}));

const mockCascadeDeleteWaiter = CascadeDeleteWaiter as jest.MockedFunction<typeof CascadeDeleteWaiter>;
const mockUseOfferFolderMove = useOfferFolderMove as jest.MockedFunction<typeof useOfferFolderMove>;

afterEach(async () => {
  await act(async () => {
    setTestFlags({});
  });
});

describe('browse-dashboards DeleteModal', () => {
  const mockOnDismiss = jest.fn();
  const mockOnConfirm = jest.fn();

  const defaultProps: Props = {
    isOpen: true,
    onConfirm: mockOnConfirm,
    onDismiss: mockOnDismiss,
    selectedItems: {
      $all: false,
      folder: {},
      dashboard: {},
      panel: {},
    },
  };

  it('renders a dialog with the correct title', async () => {
    render(<DeleteModal {...defaultProps} />);

    expect(await screen.findByRole('dialog', { name: 'Delete' })).toBeInTheDocument();
  });

  it('displays a `Delete` button', async () => {
    render(<DeleteModal {...defaultProps} />);

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('displays a `Cancel` button', async () => {
    render(<DeleteModal {...defaultProps} />);

    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('only enables the `Delete` button if the confirmation text is typed', async () => {
    render(<DeleteModal {...defaultProps} />);

    const confirmationInput = await screen.findByPlaceholderText('Type "Delete" to confirm');
    await userEvent.type(confirmationInput, 'Delete');

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('calls onConfirm when clicking the `Delete` button', async () => {
    render(<DeleteModal {...defaultProps} />);

    const confirmationInput = await screen.findByPlaceholderText('Type "Delete" to confirm');
    await userEvent.type(confirmationInput, 'Delete');

    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(mockOnConfirm).toHaveBeenCalled();
  });

  it('calls onDismiss when clicking the `Cancel` button', async () => {
    render(<DeleteModal {...defaultProps} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when clicking the X', async () => {
    render(<DeleteModal {...defaultProps} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it('warns that the selected folder contains resources', async () => {
    render(
      <DeleteModal
        {...defaultProps}
        selectedItems={{
          $all: false,
          folder: {
            [folderA.item.uid]: true,
          },
          dashboard: {},
          panel: {},
        }}
      />
    );

    expect(await screen.findByRole('alert', { name: /contains resources that will be deleted/i })).toBeInTheDocument();
  });

  describe('when deleting a folder with the async cascade delete flag enabled', () => {
    const folderSelection = {
      $all: false,
      folder: { [folderA.item.uid]: true },
      dashboard: {},
      panel: {},
    };

    beforeEach(async () => {
      await act(async () => {
        setTestFlags({ kubernetesFolderCascadeDeleteAsync: true });
      });
      mockOnConfirm.mockClear();
      mockOnDismiss.mockClear();
      mockUseOfferFolderMove.mockReturnValue(jest.fn());
      mockCascadeDeleteWaiter.mockImplementation(() => <div data-testid="waiter" />);
    });

    it('shows a notice that the delete happens in the background', async () => {
      render(<DeleteModal {...defaultProps} selectedItems={folderSelection} />);

      expect(await screen.findByText(/happens in the background/i)).toBeInTheDocument();
    });

    it('keeps the modal open, showing progress, until the cascade settles', async () => {
      render(<DeleteModal {...defaultProps} selectedItems={folderSelection} onConfirm={mockOnConfirm} />);

      const confirmationInput = await screen.findByPlaceholderText('Type "Delete" to confirm');
      await userEvent.type(confirmationInput, 'Delete');
      await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

      expect(mockOnConfirm).toHaveBeenCalled();
      expect(await screen.findByTestId('waiter')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Deleting...' })).toBeInTheDocument();
    });

    it('calls onSettled and dismisses once the cascade finishes with no errors', async () => {
      const mockOnSettled = jest.fn();
      render(
        <DeleteModal
          {...defaultProps}
          selectedItems={folderSelection}
          onConfirm={mockOnConfirm}
          onSettled={mockOnSettled}
        />
      );

      const confirmationInput = await screen.findByPlaceholderText('Type "Delete" to confirm');
      await userEvent.type(confirmationInput, 'Delete');
      await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
      await screen.findByTestId('waiter');

      const waiterProps = mockCascadeDeleteWaiter.mock.calls.at(-1)?.[0];
      await act(async () => waiterProps?.onSettled(folderA.item.uid, 'success'));

      expect(mockOnSettled).toHaveBeenCalled();
      expect(mockOnDismiss).toHaveBeenCalled();
    });

    it('keeps the modal open and offers a way to move the folder if the cascade errors out', async () => {
      const mockOnSettled = jest.fn();
      const offerFolderMove = jest.fn();
      mockUseOfferFolderMove.mockReturnValue(offerFolderMove);

      render(
        <DeleteModal
          {...defaultProps}
          selectedItems={folderSelection}
          onConfirm={mockOnConfirm}
          onSettled={mockOnSettled}
        />
      );

      const confirmationInput = await screen.findByPlaceholderText('Type "Delete" to confirm');
      await userEvent.type(confirmationInput, 'Delete');
      await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
      await screen.findByTestId('waiter');

      const waiterProps = mockCascadeDeleteWaiter.mock.calls.at(-1)?.[0];
      await act(async () => waiterProps?.onSettled(folderA.item.uid, 'error', ['dashboard X is locked']));

      expect(mockOnSettled).not.toHaveBeenCalled();
      expect(mockOnDismiss).not.toHaveBeenCalled();
      expect(screen.getByText('dashboard X is locked')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /move this folder instead/i }));
      expect(offerFolderMove).toHaveBeenCalledWith(folderA.item.uid);
      expect(mockOnDismiss).toHaveBeenCalled();
    });
  });
});
