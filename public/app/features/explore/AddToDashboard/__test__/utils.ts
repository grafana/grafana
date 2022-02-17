import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as dashboardApi from 'app/features/manage-dashboards/state/actions';
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

const foldersSearchPromise = Promise.resolve([createFolder('Folder 1', 0), createFolder('Folder 2', 0)]);
jest.spyOn(dashboardApi, 'searchFolders').mockReturnValue(foldersSearchPromise);

export const openModal = async () => {
  userEvent.click(screen.getByRole('button', { name: /add to dashboard/i }));

  return act(async () => {
    // FolderPicker asyncrounously sets its internal state based on search results, causing ugly warnings when testing.
    // Given we are not aware of the component implementation to wait on certain element to appear or disappear (for example a loading indicator),
    // we wait for the mocked promise we know it internally uses.
    // This is less than ideal as we are relying on implementation details, but is a reasonable solution for this test's scope
    await foldersSearchPromise;
  });
};
