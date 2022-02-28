import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddToDashboardModal } from './AddToDashboardModal';
import { DashboardSearchHit, DashboardSearchItemType } from 'app/features/search/types';
import * as dashboardApi from 'app/features/manage-dashboards/state/actions';

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

describe('Add to Dashboard Modal', () => {
  const searchFoldersResponse = Promise.resolve([createFolder('Folder 1', 1), createFolder('Folder 2', 2)]);

  const waitForSearchFolderResponse = async () => {
    return act(async () => {
      // FolderPicker asynchronously sets its internal state based on search results, causing warnings when testing.
      // Given we are not aware of the component implementation to wait on certain element to appear or disappear (for example a loading indicator),
      // we wait for the mocked promise we know it internally uses.
      // This is less than ideal as we are relying on implementation details, but is a reasonable solution for this test's scope
      await searchFoldersResponse;
    });
  };

  beforeEach(() => {
    jest.spyOn(dashboardApi, 'searchFolders').mockReturnValue(searchFoldersResponse);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Save to new dashboard', () => {
    it('Does not submit if the form is invalid', async () => {
      const saveMock = jest.fn();

      render(<AddToDashboardModal queries={[]} visualization="table" onSave={saveMock} onClose={() => {}} />);

      // there shouldn't be any alert in the modal
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      const dashboardNameInput = screen.getByRole<HTMLInputElement>('textbox', { name: /dashboard name/i });

      // dashboard name is required
      userEvent.clear(dashboardNameInput);

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      // The error message should appear
      await screen.findByRole('alert');

      // Create dashboard API is not invoked
      expect(saveMock).not.toHaveBeenCalled();
    });

    it('Correctly submits if the form is valid', async () => {
      const saveMock = jest.fn();

      render(<AddToDashboardModal queries={[]} visualization="table" onSave={saveMock} onClose={() => {}} />);
      await waitForSearchFolderResponse();

      const dashboardNameInput = screen.getByRole<HTMLInputElement>('textbox', { name: /dashboard name/i });

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save and keep exploring/i })).toBeEnabled();
      });

      expect(saveMock).toHaveBeenCalledWith(
        {
          dashboardName: dashboardNameInput.value,
          queries: [],
          visualization: 'table',
          folderId: 1,
        },
        expect.anything()
      );
    });
  });

  describe('Handling API errors', () => {
    it('Correctly handles name-exist API Error', async () => {
      // name-exists is triggered when trying to create a dashboard in a folder that already has a dashboard with the same name
      const saveMock = jest.fn().mockResolvedValue({ status: 'name-exists', message: 'name exists' });

      render(<AddToDashboardModal queries={[]} visualization="table" onSave={saveMock} onClose={() => {}} />);

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent('name exists');
    });

    it('Correctly handles empty name API Error', async () => {
      // empty-name is triggered when trying to create a dashboard having an empty name.
      // FE validation usually avoids this use case, but can be triggered by using only whitespaces in
      // dashboard name field
      const saveMock = jest.fn().mockResolvedValue({ status: 'empty-name', message: 'empty name' });

      render(<AddToDashboardModal queries={[]} visualization="table" onSave={saveMock} onClose={() => {}} />);

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent('empty name');
    });

    it('Correctly handles name match API Error', async () => {
      // name-match, triggered when trying to create a dashboard in a folder that has the same name.
      // it doesn't seem to ever be triggered, but matches the error in
      // https://github.com/grafana/grafana/blob/44f1e381cbc7a5e236b543bc6bd06b00e3152d7f/pkg/models/dashboards.go#L71
      const saveMock = jest.fn().mockResolvedValue({ status: 'name-match', message: 'name match' });

      render(<AddToDashboardModal queries={[]} visualization="table" onSave={saveMock} onClose={() => {}} />);

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent('name match');
    });

    it('Correctly handles unknown API Errors', async () => {
      const saveMock = jest.fn().mockResolvedValue({ status: 'unknown-error', message: 'unknown error' });

      render(<AddToDashboardModal queries={[]} visualization="table" onSave={saveMock} onClose={() => {}} />);

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent('unknown error');
    });
  });
});
