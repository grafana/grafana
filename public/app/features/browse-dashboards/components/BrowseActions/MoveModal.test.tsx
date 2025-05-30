import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { SetupServer, setupServer } from 'msw/node';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { render, screen } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { DashboardSearchHit } from 'app/features/search/types';

import { treeViewersCanEdit, wellFormedTree } from '../../fixtures/dashboardsTreeItem.fixture';

import { MoveModal, Props } from './MoveModal';

const [mockTree, { folderA, folderB, folderC, folderA_folderA, folderA_folderB }] = wellFormedTree();
const [mockTreeThatViewersCanEdit /* shares folders with wellFormedTree */] = treeViewersCanEdit();

describe('browse-dashboards MoveModal', () => {
  const mockOnDismiss = jest.fn();
  const mockOnConfirm = jest.fn();
  const mockFolders = [
    { title: 'Dashboards', uid: '' } as DashboardSearchHit,
    { title: 'Folder 1', uid: 'wfTJJL5Wz' } as DashboardSearchHit,
  ];
  let props: Props;
  let server: SetupServer;
  window.HTMLElement.prototype.scrollIntoView = () => {};

  beforeAll(() => {
    // jest.spyOn(backendSrv, 'get').mockResolvedValue({
    //   dashboard: 0,
    //   folder: 0,
    // });

    server = setupServer(
      http.get('/api/folders/:uid', () => {
        return HttpResponse.json({
          title: folderA.item.title,
          uid: folderA.item.uid,
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

        console.log('mocked folder request', url, 'response', folders);

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

    // mock the searchFolders api call so the folder picker has some folders in it
    // jest.spyOn(api, 'searchFolders').mockResolvedValue(mockFolders);
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

  it.only('only enables the `Move` button if a folder is selected', async () => {
    render(<MoveModal {...props} />);

    expect(await screen.findByRole('button', { name: 'Move' })).toBeDisabled();

    // Open the picker and wait for children to load
    const folderPicker = await screen.findByRole('button', { name: 'Select folder' });
    await userEvent.click(folderPicker);
    await screen.findByLabelText(folderA.item.title);

    // Select the folder
    await userEvent.click(screen.getByLabelText(folderA.item.title));

    expect(await screen.findByRole('button', { name: 'Move' })).toBeEnabled();
  });

  it('calls onConfirm when clicking the `Move` button', async () => {
    render(<MoveModal {...props} />);
    const folderPicker = await screen.findByTestId(selectors.components.FolderPicker.input);

    await selectOptionInTest(folderPicker, mockFolders[1].title);
    await userEvent.click(await screen.findByRole('button', { name: 'Move' }));
    expect(mockOnConfirm).toHaveBeenCalledWith(mockFolders[1].uid);
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
