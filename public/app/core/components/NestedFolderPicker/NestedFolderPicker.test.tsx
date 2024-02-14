import 'whatwg-fetch'; // fetch polyfill
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { SetupServer, setupServer } from 'msw/node';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { config } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import { wellFormedTree } from '../../../features/browse-dashboards/fixtures/dashboardsTreeItem.fixture';

import { NestedFolderPicker } from './NestedFolderPicker';

const [mockTree, { folderA, folderB, folderC, folderA_folderA, folderA_folderB }] = wellFormedTree();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

jest.mock('app/features/browse-dashboards/api/services', () => {
  const orig = jest.requireActual('app/features/browse-dashboards/api/services');

  return {
    ...orig,
    listFolders(parentUID?: string) {
      const childrenForUID = mockTree
        .filter((v) => v.item.kind === 'folder' && v.item.parentUID === parentUID)
        .map((v) => v.item);

      return Promise.resolve(childrenForUID);
    },
  };
});

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
    expect(screen.getByLabelText(folderB.item.title)).toBeInTheDocument();
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

  describe('when nestedFolders is enabled', () => {
    let originalToggles = { ...config.featureToggles };

    beforeAll(() => {
      config.featureToggles.nestedFolders = true;
    });

    afterAll(() => {
      config.featureToggles = originalToggles;
    });

    it('can expand and collapse a folder to show its children', async () => {
      render(<NestedFolderPicker onChange={mockOnChange} />);

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
      render(<NestedFolderPicker onChange={mockOnChange} />);
      const button = await screen.findByRole('button', { name: 'Select folder' });

      await userEvent.click(button);

      // Expand Folder A
      await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');

      // Folder A's children are visible
      expect(screen.getByLabelText(folderA_folderA.item.title)).toBeInTheDocument();
      expect(screen.getByLabelText(folderA_folderB.item.title)).toBeInTheDocument();

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
