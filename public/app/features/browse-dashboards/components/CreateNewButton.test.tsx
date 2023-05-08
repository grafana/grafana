import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CreateNewButton } from './CreateNewButton';

async function renderAndOpen(folderUID?: string) {
  render(<CreateNewButton canCreateDashboard canCreateFolder inFolder={folderUID} />);
  const newButton = screen.getByText('New');
  await userEvent.click(newButton);
}

describe('NewActionsButton', () => {
  it('should display the correct urls with a given folderUID', async () => {
    await renderAndOpen('123');

    expect(screen.getByText('New Dashboard')).toHaveAttribute('href', '/dashboard/new?folderUid=123');
    expect(screen.getByText('New Folder')).toHaveAttribute('href', '/dashboards/folder/new?folderUid=123');
    expect(screen.getByText('Import')).toHaveAttribute('href', '/dashboard/import?folderUid=123');
  });

  it('should display urls without params when there is no folderUID', async () => {
    await renderAndOpen();

    expect(screen.getByText('New Dashboard')).toHaveAttribute('href', '/dashboard/new');
    expect(screen.getByText('New Folder')).toHaveAttribute('href', '/dashboards/folder/new');
    expect(screen.getByText('Import')).toHaveAttribute('href', '/dashboard/import');
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
