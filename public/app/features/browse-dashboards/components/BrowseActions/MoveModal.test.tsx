import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { SetupServer, setupServer } from 'msw/node';
import { render, screen } from 'test/test-utils';

import { backendSrv } from 'app/core/services/backend_srv';

import { treeViewersCanEdit, wellFormedTree } from '../../fixtures/dashboardsTreeItem.fixture';

import { MoveModal, Props } from './MoveModal';

const [mockTree, { folderA }] = wellFormedTree();
const [mockTreeThatViewersCanEdit /* shares folders with wellFormedTree */] = treeViewersCanEdit();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

describe('browse-dashboards MoveModal', () => {
  const mockOnDismiss = jest.fn();
  const mockOnConfirm = jest.fn();
  let props: Props;
  let server: SetupServer;
  window.HTMLElement.prototype.scrollIntoView = () => {};

  beforeAll(() => {
    server = setupServer(
      http.get('/api/folders/:uid', () => {
        return HttpResponse.json({
          title: folderA.item.title,
          uid: folderA.item.uid,
        });
      }),

      http.get('/api/folders/:uid/counts', () => {
        return HttpResponse.json({
          folder: 1,
          dashboard: 2,
          librarypanel: 3,
          alertrule: 4,
        });
      }),

      http.get('/apis/provisioning.grafana.app/v0alpha1/namespaces/default/settings', () => {
        return HttpResponse.json({
          items: [],
        });
      }),

      http.get('/api/folders', ({ request }) => {
        const url = new URL(request.url);
        const parentUid = url.searchParams.get('parentUid') ?? undefined;
        const permission = url.searchParams.get('permission');

        const limit = parseInt(url.searchParams.get('limit') ?? '1000', 10);
        const page = parseInt(url.searchParams.get('page') ?? '1', 10);

        const tree = permission === 'Edit' ? mockTreeThatViewersCanEdit : mockTree;

        // reconstruct a folder API response from the flat tree fixture
        const folders = tree
          .filter((v) => v.item.kind === 'folder' && v.item.parentUID === parentUid)
          .map((folder) => {
            return {
              uid: folder.item.uid,
              title: folder.item.kind === 'folder' ? folder.item.title : "invalid - this shouldn't happen",
            };
          })
          .slice(limit * (page - 1), limit * page);

        return HttpResponse.json(folders);
      })
    );

    server.listen();
  });

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

  afterAll(() => {
    server.close();
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

  it('displays a warning about permissions if a folder is selected', async () => {
    props.selectedItems.folder = {
      myFolderUid: true,
    };
    render(<MoveModal {...props} />);

    expect(
      await screen.findByRole('status', { name: 'Moving this item may change its permissions.' })
    ).toBeInTheDocument();
  });

  it('enables the `Move` button once a folder is selected', async () => {
    render(<MoveModal {...props} />);

    expect(await screen.findByRole('button', { name: 'Move' })).toBeDisabled();

    // Open the picker and wait for children to load
    const folderPicker = await screen.findByRole('button', { name: 'Select folder' });
    await userEvent.click(folderPicker);
    await screen.findByLabelText(folderA.item.title);

    // Select the folder
    await userEvent.click(screen.getByLabelText(folderA.item.title));

    const moveButton = await screen.findByRole('button', { name: 'Move' });
    expect(moveButton).toBeEnabled();

    await userEvent.click(moveButton);
    expect(mockOnConfirm).toHaveBeenCalledWith(folderA.item.uid);
  });

  it('calls onDismiss when clicking the `Cancel` button', async () => {
    render(<MoveModal {...props} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when clicking the X', async () => {
    render(<MoveModal {...props} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    expect(mockOnDismiss).toHaveBeenCalled();
  });
});
