import { render as rtlRender, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import CreateNewButton from './CreateNewButton';

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

async function renderAndOpen(folderUID?: string) {
  render(<CreateNewButton canCreateDashboard canCreateFolder parentFolderUid={folderUID} />);
  const newButton = screen.getByText('New');
  await userEvent.click(newButton);
}

describe('NewActionsButton', () => {
  it('should display the correct urls with a given folderUID', async () => {
    await renderAndOpen('123');

    expect(screen.getByText('New Dashboard')).toHaveAttribute('href', '/dashboard/new?folderUid=123');
    expect(screen.getByText('Import')).toHaveAttribute('href', '/dashboard/import?folderUid=123');
  });

  it('should display urls without params when there is no folderUID', async () => {
    await renderAndOpen();

    expect(screen.getByText('New Dashboard')).toHaveAttribute('href', '/dashboard/new');
    expect(screen.getByText('Import')).toHaveAttribute('href', '/dashboard/import');
  });

  it('clicking the "New folder" button opens the drawer', async () => {
    const mockParentFolderTitle = 'mockParentFolderTitle';
    render(<CreateNewButton canCreateDashboard canCreateFolder parentFolderTitle={mockParentFolderTitle} />);

    const newButton = screen.getByText('New');
    await userEvent.click(newButton);
    await userEvent.click(screen.getByText('New Folder'));

    const drawer = screen.getByRole('dialog', { name: 'Drawer title New Folder' });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByRole('heading', { name: 'New Folder' })).toBeInTheDocument();
    expect(within(drawer).getByText(`Location: ${mockParentFolderTitle}`)).toBeInTheDocument();
  });

  it('should only render dashboard items when folder creation is disabled', async () => {
    render(<CreateNewButton canCreateDashboard canCreateFolder={false} />);
    const newButton = screen.getByText('New');
    await userEvent.click(newButton);

    expect(screen.getByText('New Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
    expect(screen.queryByText('New Folder')).not.toBeInTheDocument();
  });

  it('should only render folder item when dashboard creation is disabled', async () => {
    render(<CreateNewButton canCreateDashboard={false} canCreateFolder />);
    const newButton = screen.getByText('New');
    await userEvent.click(newButton);

    expect(screen.queryByText('New Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Import')).not.toBeInTheDocument();
    expect(screen.getByText('New Folder')).toBeInTheDocument();
  });
});
