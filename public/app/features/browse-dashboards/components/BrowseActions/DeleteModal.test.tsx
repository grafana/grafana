import { act, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures, setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { DeleteModal, type Props } from './DeleteModal';

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

const [_, { folderA }] = getFolderFixtures();

setBackendSrv(backendSrv);
setupMockServer();

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

  afterEach(() => {
    mockOnDismiss.mockClear();
    mockOnConfirm.mockClear();
  });

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
    });

    it('shows a notice that the delete happens in the background', async () => {
      render(<DeleteModal {...defaultProps} selectedItems={folderSelection} />);

      expect(await screen.findByText(/happens in the background/i)).toBeInTheDocument();
    });

    it('dismisses as soon as the delete request is accepted, without waiting for the cascade', async () => {
      // The cascade this kicks off (if any) keeps running in the background -- ongoing progress
      // and any stuck-cascade errors are surfaced elsewhere (FolderCascadeStatusBanner,
      // DeletingFolderBadge/DeletingDashboardBadge), not by this modal staying open.
      render(<DeleteModal {...defaultProps} selectedItems={folderSelection} onConfirm={mockOnConfirm} />);

      const confirmationInput = await screen.findByPlaceholderText('Type "Delete" to confirm');
      await userEvent.type(confirmationInput, 'Delete');
      await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

      expect(mockOnConfirm).toHaveBeenCalled();
      expect(mockOnDismiss).toHaveBeenCalled();
    });
  });
});
