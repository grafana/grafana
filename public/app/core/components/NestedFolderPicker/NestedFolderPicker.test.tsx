import 'whatwg-fetch'; // fetch polyfill
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { SetupServer, setupServer } from 'msw/node';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

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
  let server: SetupServer;

  beforeAll(() => {
    server = setupServer(
      rest.get('/api/folders/:uid', (_, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            title: folderA.item.title,
            uid: folderA.item.uid,
          })
        );
      })
    );
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('renders a button with the correct label when no folder is selected', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} />);
    expect(await screen.findByRole('button', { name: 'Select folder' })).toBeInTheDocument();
  });

  it('renders a button with the folder name instead when a folder is selected', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} value="folderA" />);
    expect(await screen.findByRole('button', { name: folderA.item.title })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select folder' })).not.toBeInTheDocument();
  });

  it('clicking the button opens the folder picker', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} />);
    const button = await screen.findByRole('button', { name: 'Select folder' });

    await userEvent.click(button);

    // Select folder button is no longer visible
    expect(screen.queryByRole('button', { name: 'Select folder' })).not.toBeInTheDocument();

    // Search input and folder tree are visible
    expect(screen.getByPlaceholderText('Search folder')).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboards')).toBeInTheDocument();
    expect(screen.getByLabelText(folderA.item.title)).toBeInTheDocument();
    expect(screen.getByLabelText(folderB.item.title)).toBeInTheDocument();
    expect(screen.getByLabelText(folderC.item.title)).toBeInTheDocument();
  });

  it('can select a folder from the picker', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} />);
    const button = await screen.findByRole('button', { name: 'Select folder' });

    await userEvent.click(button);

    await userEvent.click(screen.getByLabelText(folderA.item.title));
    expect(mockOnChange).toHaveBeenCalledWith({
      uid: folderA.item.uid,
      title: folderA.item.title,
    });
  });

  it('can expand and collapse a folder to show its children', async () => {
    render(<NestedFolderPicker onChange={mockOnChange} />);
    const button = await screen.findByRole('button', { name: 'Select folder' });

    await userEvent.click(button);

    // Expand Folder A
    await userEvent.click(screen.getByRole('button', { name: `Expand folder ${folderA.item.title}` }));

    // Folder A's children are visible
    expect(screen.getByLabelText(folderA_folderA.item.title)).toBeInTheDocument();
    expect(screen.getByLabelText(folderA_folderB.item.title)).toBeInTheDocument();

    // Collapse Folder A
    await userEvent.click(screen.getByRole('button', { name: `Collapse folder ${folderA.item.title}` }));
    expect(screen.queryByLabelText(folderA_folderA.item.title)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(folderA_folderB.item.title)).not.toBeInTheDocument();
  });
});
