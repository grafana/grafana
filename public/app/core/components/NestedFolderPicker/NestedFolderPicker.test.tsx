import { fireEvent, render, screen } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { NestedFolderPicker } from './NestedFolderPicker';

const [_, { folderA, folderB, folderC, folderA_folderA, folderA_folderB, folderA_folderC }] = getFolderFixtures();

setupMockServer();
setBackendSrv(backendSrv);

describe('NestedFolderPicker', () => {
  const mockOnChange = jest.fn();
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = function () {};
  });

  afterAll(() => {
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders a button with the correct label when no folder is selected', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} />);
    expect(await screen.findByRole('button', { name: 'Select folder' })).toBeInTheDocument();
  });

  it('renders a button with the correct label when a folder is selected', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} value={folderA.item.uid} />);
    expect(
      await screen.findByRole('button', { name: `Select folder: ${folderA.item.title} currently selected` })
    ).toBeInTheDocument();
  });

  it('clicking the button opens the folder picker', async () => {
    const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
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
    const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
    await screen.findByLabelText(folderA.item.title);

    await user.click(screen.getByLabelText(folderA.item.title));
    expect(mockOnChange).toHaveBeenCalledWith(folderA.item.uid, folderA.item.title);
  });

  it('can clear a selection if clearable is specified', async () => {
    const { user } = render(<NestedFolderPicker clearable value={folderA.item.uid} onChange={mockOnChange} />);

    await user.click(await screen.findByRole('button', { name: 'Clear selection' }));
    expect(mockOnChange).toHaveBeenCalledWith(undefined, undefined);
  });

  it('can select a folder from the picker with the keyboard', async () => {
    const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
    const button = await screen.findByRole('button', { name: 'Select folder' });

    await user.click(button);

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(mockOnChange).toHaveBeenCalledWith(folderC.item.uid, folderC.item.title);
  });

  it('shows the root folder by default', async () => {
    const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
    await screen.findByLabelText(folderA.item.title);

    await user.click(screen.getByLabelText('Dashboards'));
    expect(mockOnChange).toHaveBeenCalledWith('', 'Dashboards');
  });

  it('hides the root folder if the prop says so', async () => {
    const { user } = render(<NestedFolderPicker showRootFolder={false} onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
    await screen.findByLabelText(folderA.item.title);

    expect(screen.queryByLabelText('Dashboards')).not.toBeInTheDocument();
  });

  it('hides folders specififed by UID', async () => {
    const { user } = render(<NestedFolderPicker excludeUIDs={[folderC.item.uid]} onChange={mockOnChange} />);

    // Open the picker and wait for children to load
    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
    await screen.findByLabelText(folderA.item.title);

    expect(screen.queryByLabelText(folderC.item.title)).not.toBeInTheDocument();
  });

  it('by default only shows items the user can edit', async () => {
    const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);

    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
    await screen.findByLabelText(folderA.item.title);

    expect(screen.queryByLabelText(folderB.item.title)).not.toBeInTheDocument(); // folderB is not editable
    expect(screen.getByLabelText(folderC.item.title)).toBeInTheDocument(); // but folderC is
  });

  it('shows items the user can view, with the prop', async () => {
    const { user } = render(<NestedFolderPicker permission="view" onChange={mockOnChange} />);

    const button = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(button);
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
      const { user } = render(<NestedFolderPicker permission="view" onChange={mockOnChange} />);

      // Open the picker and wait for children to load
      const button = await screen.findByRole('button', { name: 'Select folder' });
      await user.click(button);
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
      await user.click(screen.getByLabelText(folderA_folderA.item.title));
      expect(mockOnChange).toHaveBeenCalledWith(folderA_folderA.item.uid, folderA_folderA.item.title);
    });

    it('can expand and collapse a folder to show its children with the keyboard', async () => {
      const { user } = render(<NestedFolderPicker permission="view" onChange={mockOnChange} />);
      const button = await screen.findByRole('button', { name: 'Select folder' });

      await user.click(button);

      // Expand Folder A
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowRight}');

      // Folder A's children are visible
      expect(await screen.findByLabelText(folderA_folderA.item.title)).toBeInTheDocument();
      expect(await screen.findByLabelText(folderA_folderB.item.title)).toBeInTheDocument();
      expect(await screen.findByLabelText(folderA_folderC.item.title)).toBeInTheDocument();

      // Collapse Folder A
      await user.keyboard('{ArrowLeft}');
      expect(screen.queryByLabelText(folderA_folderA.item.title)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(folderA_folderB.item.title)).not.toBeInTheDocument();

      // Expand Folder A again
      await user.keyboard('{ArrowRight}');

      // Select the first child
      await user.keyboard('{ArrowDown}{Enter}');
      expect(mockOnChange).toHaveBeenCalledWith(folderA_folderC.item.uid, folderA_folderC.item.title);
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
      const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);

      // Open the picker and wait for children to load
      const button = await screen.findByRole('button', { name: 'Select folder' });
      await user.click(button);
      await screen.findByLabelText(folderA.item.title);

      // There should be no expand button
      // Note: we need to use mouseDown here because userEvent's click event doesn't get prevented correctly
      expect(screen.queryByRole('button', { name: `Expand folder ${folderA.item.title}` })).not.toBeInTheDocument();
    });

    it('does not expand a folder with the keyboard', async () => {
      const { user } = render(<NestedFolderPicker onChange={mockOnChange} />);
      const button = await screen.findByRole('button', { name: 'Select folder' });

      await user.click(button);

      // try to expand Folder A
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');

      // Folder A's children are not visible
      expect(screen.queryByLabelText(folderA_folderA.item.title)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(folderA_folderB.item.title)).not.toBeInTheDocument();
    });
  });
});
