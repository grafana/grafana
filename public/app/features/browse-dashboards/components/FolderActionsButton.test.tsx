import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { appEvents, contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { ShowModalReactEvent } from 'app/types/events';

import { mockFolderDTO } from '../fixtures/folder.fixture';

import { DeleteModal } from './BrowseActions/DeleteModal';
import { MoveModal } from './BrowseActions/MoveModal';
import { FolderActionsButton } from './FolderActionsButton';

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

// Mock out the Permissions component for now
jest.mock('app/core/components/AccessControl', () => ({
  Permissions: () => <div>Hello!</div>,
}));

describe('browse-dashboards FolderActionsButton', () => {
  const mockFolder = mockFolderDTO();

  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not render anything when the user has no permissions to do anything', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    render(<FolderActionsButton folder={mockFolder} />);
    expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
  });

  it('renders a "Folder actions" button when the user has permissions to do something', () => {
    render(<FolderActionsButton folder={mockFolder} />);
    expect(screen.getByRole('button', { name: 'Folder actions' })).toBeInTheDocument();
  });

  it('renders all the options if the user has full permissions', async () => {
    render(<FolderActionsButton folder={mockFolder} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    expect(screen.getByRole('menuitem', { name: 'Manage permissions' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Move' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('does not render the "Manage permissions" option if the user does not have permission to view permissions', async () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((permission: string) => permission !== AccessControlAction.FoldersPermissionsRead);
    render(<FolderActionsButton folder={mockFolder} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    expect(screen.queryByRole('menuitem', { name: 'Manage permissions' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Move' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('does not render the "Move" option if the user does not have permission to edit', async () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((permission: string) => permission !== AccessControlAction.FoldersWrite);
    render(<FolderActionsButton folder={mockFolder} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    expect(screen.getByRole('menuitem', { name: 'Manage permissions' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Move' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('does not render the "Delete" option if the user does not have permission to delete', async () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((permission: string) => permission !== AccessControlAction.FoldersDelete);
    render(<FolderActionsButton folder={mockFolder} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    expect(screen.getByRole('menuitem', { name: 'Manage permissions' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Move' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('clicking the "Manage permissions" option opens the permissions drawer', async () => {
    render(<FolderActionsButton folder={mockFolder} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Manage permissions' }));
    expect(screen.getByRole('dialog', { name: 'Drawer title Manage permissions' })).toBeInTheDocument();
  });

  it('clicking the "Move" option opens the move modal', async () => {
    jest.spyOn(appEvents, 'publish');
    render(<FolderActionsButton folder={mockFolder} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move' }));
    expect(appEvents.publish).toHaveBeenCalledWith(
      new ShowModalReactEvent(
        expect.objectContaining({
          component: MoveModal,
        })
      )
    );
  });

  it('clicking the "Delete" option opens the delete modal', async () => {
    jest.spyOn(appEvents, 'publish');
    render(<FolderActionsButton folder={mockFolder} />);

    await userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(appEvents.publish).toHaveBeenCalledWith(
      new ShowModalReactEvent(
        expect.objectContaining({
          component: DeleteModal,
        })
      )
    );
  });
});
