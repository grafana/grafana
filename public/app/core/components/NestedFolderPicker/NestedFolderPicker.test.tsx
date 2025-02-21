import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { SetupServer, setupServer } from 'msw/node';
import { TestProvider } from 'test/helpers/TestProvider';

import { config } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import {
  treeViewersCanEdit,
  wellFormedTree,
} from '../../../features/browse-dashboards/fixtures/dashboardsTreeItem.fixture';

import { NestedFolderPicker } from './NestedFolderPicker';

const [mockTree, { folderA, folderB, folderC, folderA_folderA, folderA_folderB }] = wellFormedTree();
const [mockTreeThatViewersCanEdit /* shares folders with wellFormedTree */] = treeViewersCanEdit();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

describe('NestedFolderPicker', () => {
  const mockOnChange = jest.fn();
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
  let server: SetupServer;

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = function () {};

    server = setupServer(
      http.get('/api/folders/:uid', () => {
        return HttpResponse.json({
          title: folderA.item.title,
          uid: folderA.item.uid,
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

  afterAll(() => {
    server.close();
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.resetHandlers();
  });

  it('renders a button with the correct label when no folder is selected', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} />);
    expect(await screen.findByRole('button', { name: 'Select folder' })).toBeInTheDocument();
  });

  it('renders a button with the correct label when a folder is selected', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} value="folderA" />);
    expect(
      await screen.findByRole('button', { name: `Select folder: ${folderA.item.title} currently selected` })
    ).toBeInTheDocument();
  });

  it('clicking the button opens the folder picker', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await userEvent.click(button);
    await screen.findByLabelText(folderA.item.title);

    // Select folder button is no longer visible
    expect(screen.queryByRole('button', { name: 'Select folder' })).not.toBeInTheDocument();

    // Search input and folder tree are visible
    expect(screen.getByPlaceholderText('Search folders')).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboards')).toBeInTheDocument();
    expect(screen.getByLabelText(folderA.item.title)).toBeInTheDocument();
    // expect(screen.getByLabelText(folderB.item.title)).toBeInTheDocument();
    expect(screen.getByLabelText(folderC.item.title)).toBeInTheDocument();
  });

  it('can select a folder from the picker', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await userEvent.click(button);
    await screen.findByLabelText(folderA.item.title);

    await userEvent.click(screen.getByLabelText(folderA.item.title));
    expect(mockOnChange).toHaveBeenCalledWith(folderA.item.uid, folderA.item.title);
  });

  it('can clear a selection if clearable is specified', async () => {
    render(<NestedFolderPicker clearable value={folderA.item.uid} onChange={mockOnChange} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Clear selection' }));
    expect(mockOnChange).toHaveBeenCalledWith(undefined, undefined);
  });

  it('can select a folder from the picker with the keyboard', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} />);
    const button = await screen.findByRole('button', { name: 'Select folder' });

    await userEvent.click(button);

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(mockOnChange).toHaveBeenCalledWith(folderA.item.uid, folderA.item.title);
  });

  it('shows the root folder by default', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await userEvent.click(button);
    await screen.findByLabelText(folderA.item.title);

    await userEvent.click(screen.getByLabelText('Dashboards'));
    expect(mockOnChange).toHaveBeenCalledWith('', 'Dashboards');
  });

  it('hides the root folder if the prop says so', async () => {
    render(<NestedFolderPicker showRootFolder={false} onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await userEvent.click(button);
    await screen.findByLabelText(folderA.item.title);

    expect(screen.queryByLabelText('Dashboards')).not.toBeInTheDocument();
  });

  it('hides folders specififed by UID', async () => {
    render(<NestedFolderPicker excludeUIDs={[folderC.item.uid]} onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await userEvent.click(button);
    await screen.findByLabelText(folderA.item.title);

    expect(screen.queryByLabelText(folderC.item.title)).not.toBeInTheDocument();
  });

  it('by default only shows items the user can edit', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} />);

    const button = await screen.findByRole('button', { name: 'Select folder' });
    await userEvent.click(button);
    await screen.findByLabelText(folderA.item.title);

    expect(screen.queryByLabelText(folderB.item.title)).not.toBeInTheDocument(); // folderB is not editable
    expect(screen.getByLabelText(folderC.item.title)).toBeInTheDocument(); // but folderC is
  });

  it('shows items the user can view, with the prop', async () => {
    render(<NestedFolderPicker permission="view" onChange={mockOnChange} />);

    const button = await screen.findByRole('button', { name: 'Select folder' });
    await userEvent.click(button);
    await screen.findByLabelText(folderA.item.title);

    expect(screen.getByLabelText(folderB.item.title)).toBeInTheDocument();
    expect(screen.getByLabelText(folderC.item.title)).toBeInTheDocument();
  });

  describe('when nestedFolders is enabled', () => {
    let originalToggles = { ...config.featureToggles };

    beforeAll(() => {
      config.featureToggles.nestedFolders = true;
    });

    afterAll(() => {
      config.featureToggles = originalToggles;
    });

    it('can expand and collapse a folder to show its children', async () => {
      render(<NestedFolderPicker permission="view" onChange={mockOnChange} />);

      // Open the picker and wait for children to load
      const button = await screen.findByRole('button', { name: 'Select folder' });
      await userEvent.click(button);
      await screen.findByLabelText(folderA.item.title);

      // Expand Folder A
      // Note: we need to use mouseDown here because userEvent's click event doesn't get prevented correctly
      fireEvent.mouseDown(screen.getByRole('button', { name: `Expand folder ${folderA.item.title}` }));

      // Folder A's children are visible
      expect(await screen.findByLabelText(folderA_folderA.item.title)).toBeInTheDocument();
      expect(await screen.findByLabelText(folderA_folderB.item.title)).toBeInTheDocument();

      // Collapse Folder A
      // Note: we need to use mouseDown here because userEvent's click event doesn't get prevented correctly
      fireEvent.mouseDown(screen.getByRole('button', { name: `Collapse folder ${folderA.item.title}` }));
      expect(screen.queryByLabelText(folderA_folderA.item.title)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(folderA_folderB.item.title)).not.toBeInTheDocument();

      // Expand Folder A again
      // Note: we need to use mouseDown here because userEvent's click event doesn't get prevented correctly
      fireEvent.mouseDown(screen.getByRole('button', { name: `Expand folder ${folderA.item.title}` }));

      // Select the first child
      await userEvent.click(screen.getByLabelText(folderA_folderA.item.title));
      expect(mockOnChange).toHaveBeenCalledWith(folderA_folderA.item.uid, folderA_folderA.item.title);
    });

    it('can expand and collapse a folder to show its children with the keyboard', async () => {
      render(<NestedFolderPicker permission="view" onChange={mockOnChange} />);
      const button = await screen.findByRole('button', { name: 'Select folder' });

      await userEvent.click(button);

      // Expand Folder A
      await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');

      // Folder A's children are visible
      expect(await screen.findByLabelText(folderA_folderA.item.title)).toBeInTheDocument();
      expect(await screen.findByLabelText(folderA_folderB.item.title)).toBeInTheDocument();

      // Collapse Folder A
      await userEvent.keyboard('{ArrowLeft}');
      expect(screen.queryByLabelText(folderA_folderA.item.title)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(folderA_folderB.item.title)).not.toBeInTheDocument();

      // Expand Folder A again
      await userEvent.keyboard('{ArrowRight}');

      // Select the first child
      await userEvent.keyboard('{ArrowDown}{Enter}');
      expect(mockOnChange).toHaveBeenCalledWith(folderA_folderA.item.uid, folderA_folderA.item.title);
    });
  });

  describe('when nestedFolders is disabled', () => {
    let originalToggles = { ...config.featureToggles };

    beforeAll(() => {
      config.featureToggles.nestedFolders = false;
    });

    afterAll(() => {
      config.featureToggles = originalToggles;
    });

    it('does not show an expand button', async () => {
      render(<NestedFolderPicker onChange={mockOnChange} />);

      // Open the picker and wait for children to load
      const button = await screen.findByRole('button', { name: 'Select folder' });
      await userEvent.click(button);
      await screen.findByLabelText(folderA.item.title);

      // There should be no expand button
      // Note: we need to use mouseDown here because userEvent's click event doesn't get prevented correctly
      expect(screen.queryByRole('button', { name: `Expand folder ${folderA.item.title}` })).not.toBeInTheDocument();
    });

    it('does not expand a folder with the keyboard', async () => {
      render(<NestedFolderPicker onChange={mockOnChange} />);
      const button = await screen.findByRole('button', { name: 'Select folder' });

      await userEvent.click(button);

      // try to expand Folder A
      await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');

      // Folder A's children are not visible
      expect(screen.queryByLabelText(folderA_folderA.item.title)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(folderA_folderB.item.title)).not.toBeInTheDocument();
    });
  });
});
