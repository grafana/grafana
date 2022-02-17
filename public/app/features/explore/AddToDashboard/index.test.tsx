import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AddToDashboardButton } from '.';
import userEvent from '@testing-library/user-event';
import * as api from 'app/features/manage-dashboards/state/actions';
import { DashboardSearchHit, DashboardSearchItemType } from 'app/features/search/types';

const createFolder = (title: string, id: number): DashboardSearchHit => ({
  title,
  id,
  isStarred: false,
  type: DashboardSearchItemType.DashFolder,
  items: [],
  url: '',
  uri: '',
  tags: [],
});

describe('Add to Dashboard', () => {
  it('Opens and closes the modal correctly', async () => {
    const foldersSearchPromise = Promise.resolve([createFolder('Folder 1', 0), createFolder('Folder 2', 0)]);
    jest.spyOn(api, 'searchFolders').mockReturnValue(foldersSearchPromise);

    render(<AddToDashboardButton queries={[]} visualization="table" />);

    userEvent.click(screen.getByRole('button', { name: /add to dashboard/i }));

    // waiting on https://github.com/grafana/grafana/pull/45472 to properly test this:
    // expect(screen.getByRole('dialog', { name: 'Add query to dashboard' })).toBeInTheDocument();
    // expect(screen.getByLabelText('Add query to dashboard')).toBeInTheDocument();
    expect(screen.getByText('Add query to dashboard')).toBeInTheDocument();

    await act(async () => {
      // FolderPicker asyncrounously sets its internal state based on search results, causing ugly warnings when testing.
      // Given we are not aware of the component implementation to wait on certain element to appear or disappear (for example a loading indicator),
      // we wait for the mocked promise we know it internally uses.
      // This is less than ideal as we are relying on implementation details, but is a reasonable solution for this test's scope
      await foldersSearchPromise;
    });

    userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    // TODO: once https://github.com/grafana/grafana/pull/45472 is merged replace with
    // expect(screen.queryByRole('dialog')).toBeInTheDocument();

    expect(screen.queryByText('Add query to dashboard')).not.toBeInTheDocument();
  });

  describe('Save to new dashboard', () => {});
});
