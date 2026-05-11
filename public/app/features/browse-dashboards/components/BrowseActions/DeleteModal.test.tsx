import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { type StoreState } from 'app/types/store';

import { DeleteModal, type Props } from './DeleteModal';

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

function renderWithStore(ui: React.ReactElement, storeState: Partial<StoreState>) {
  rtlRender(<TestProvider storeState={storeState}>{ui}</TestProvider>);
}

const [_, { folderA, dashbdD, dashbdE }] = getFolderFixtures();

setBackendSrv(backendSrv);
setupMockServer();

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

  it('shows a numeric affected item count for a single folder selection', async () => {
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

    expect(await screen.findByText(/This action will delete the folder/i)).toBeInTheDocument();
    expect(await screen.findByText(/5 item/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN item/)).not.toBeInTheDocument();
  });

  it('shows dashboard names when a small number of dashboards are selected', async () => {
    const storeState: Partial<StoreState> = {
      browseDashboards: {
        rootItems: {
          items: [dashbdD.item, dashbdE.item],
          lastFetchedKind: 'dashboard',
          lastFetchedPage: 1,
          lastKindHasMoreItems: false,
          isFullyLoaded: true,
        },
        childrenByParentUID: {},
        openFolders: {},
        selectedItems: {
          dashboard: { [dashbdD.item.uid]: true },
          folder: {},
          panel: {},
          $all: false,
        },
      },
    };

    renderWithStore(
      <DeleteModal
        {...defaultProps}
        selectedItems={{
          $all: false,
          folder: {},
          dashboard: { [dashbdD.item.uid]: true },
          panel: {},
        }}
      />,
      storeState
    );

    expect(await screen.findByText(dashbdD.item.title)).toBeInTheDocument();
    expect(await screen.findByText(/This action will delete the following:/i)).toBeInTheDocument();
  });

  it('shows multiple dashboard names when a few dashboards are selected', async () => {
    const storeState: Partial<StoreState> = {
      browseDashboards: {
        rootItems: {
          items: [dashbdD.item, dashbdE.item],
          lastFetchedKind: 'dashboard',
          lastFetchedPage: 1,
          lastKindHasMoreItems: false,
          isFullyLoaded: true,
        },
        childrenByParentUID: {},
        openFolders: {},
        selectedItems: {
          dashboard: { [dashbdD.item.uid]: true, [dashbdE.item.uid]: true },
          folder: {},
          panel: {},
          $all: false,
        },
      },
    };

    renderWithStore(
      <DeleteModal
        {...defaultProps}
        selectedItems={{
          $all: false,
          folder: {},
          dashboard: { [dashbdD.item.uid]: true, [dashbdE.item.uid]: true },
          panel: {},
        }}
      />,
      storeState
    );

    expect(await screen.findByText(dashbdD.item.title)).toBeInTheDocument();
    expect(await screen.findByText(dashbdE.item.title)).toBeInTheDocument();
  });
});
