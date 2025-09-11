import { render, screen } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { MoveModal, Props } from './MoveModal';

const [_, { folderA }] = getFolderFixtures();

setBackendSrv(backendSrv);
setupMockServer();

const originalToggles = { ...config.featureToggles };

describe('browse-dashboards MoveModal', () => {
  const mockOnDismiss = jest.fn();
  const mockOnConfirm = jest.fn();
  let props: Props;
  window.HTMLElement.prototype.scrollIntoView = () => {};

  beforeEach(() => {
    props = {
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
  });

  it('renders a dialog with the correct title', async () => {
    render(<MoveModal {...props} />);

    expect(await screen.findByRole('dialog', { name: 'Move' })).toBeInTheDocument();
  });

  it('displays a `Move` button', async () => {
    render(<MoveModal {...props} />);

    expect(await screen.findByRole('button', { name: 'Move' })).toBeInTheDocument();
  });

  it('displays a `Cancel` button', async () => {
    render(<MoveModal {...props} />);

    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('displays a folder picker', async () => {
    render(<MoveModal {...props} />);

    expect(await screen.findByRole('button', { name: 'Select folder' })).toBeInTheDocument();
  });

  describe('when a folder is selected', () => {
    describe.each([
      // app platform
      true,
      // legacy
      false,
    ])('with foldersAppPlatformAPI set to %s', (toggle) => {
      beforeEach(() => {
        config.featureToggles.foldersAppPlatformAPI = toggle;
      });
      afterEach(() => {
        config.featureToggles = originalToggles;
      });

      it('displays a warning about permissions if a folder is selected', async () => {
        props.selectedItems.folder = {
          [folderA.item.uid]: true,
        };
        render(<MoveModal {...props} />);

        expect(
          await screen.findByRole('status', { name: 'Moving this item may change its permissions.' })
        ).toBeInTheDocument();
      });

      it('displays summary of affected items', async () => {
        props.selectedItems.folder = {
          [folderA.item.uid]: true,
        };
        render(<MoveModal {...props} />);

        expect(await screen.findByText(/This action will move the following content/i)).toBeInTheDocument();

        expect(await screen.findByText(/5 item/)).toBeInTheDocument();
        expect(screen.getByText(/2 folder/)).toBeInTheDocument();
        expect(screen.getByText(/1 dashboard/)).toBeInTheDocument();
        expect(screen.getByText(/1 library panel/)).toBeInTheDocument();
        expect(screen.getByText(/1 alert rule/)).toBeInTheDocument();
      });
    });
  });

  it('enables the `Move` button once a folder is selected', async () => {
    const { user } = render(<MoveModal {...props} />);

    expect(await screen.findByRole('button', { name: 'Move' })).toBeDisabled();

    // Open the picker and wait for children to load
    const folderPicker = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(folderPicker);
    await screen.findByLabelText(folderA.item.title);

    // Select the folder
    await user.click(screen.getByLabelText(folderA.item.title));

    const moveButton = await screen.findByRole('button', { name: 'Move' });
    expect(moveButton).toBeEnabled();

    await user.click(moveButton);
    expect(mockOnConfirm).toHaveBeenCalledWith(folderA.item.uid);
  });

  it('calls onDismiss when clicking the `Cancel` button', async () => {
    const { user } = render(<MoveModal {...props} />);

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when clicking the X', async () => {
    const { user } = render(<MoveModal {...props} />);

    await user.click(await screen.findByRole('button', { name: 'Close' }));
    expect(mockOnDismiss).toHaveBeenCalled();
  });
});
