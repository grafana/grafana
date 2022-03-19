import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddToDashboardModal } from './AddToDashboardModal';
import { DashboardSearchHit, DashboardSearchItemType } from 'app/features/search/types';
import * as dashboardApi from 'app/features/manage-dashboards/state/actions';
import { backendSrv } from 'app/core/services/backend_srv';

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
  const searchDashboardResponse = Promise.resolve<DashboardSearchHit[]>([
    {
      uid: 'someUid',
      title: 'dashboardTitle',
      id: 1,
      isStarred: false,
      tags: [],
      items: [],
      type: DashboardSearchItemType.DashDB,
      uri: '/uri',
      url: 'url',
    },
  ]);

  const waitForSearchFolderResponse = async () => {
    return act(async () => {
      // FolderPicker asynchronously sets its internal state based on search results, causing warnings when testing.
      // Given we are not aware of the component implementation to wait on certain element to appear or disappear (for example a loading indicator),
      // we wait for the mocked promise we know it internally uses.
      // This is less than ideal as we are relying on implementation details, but is a reasonable solution for this test's scope
      await searchFoldersResponse;
    });
  };

  const waitForSearchDashboardResponse = async () => {
    return act(async () => {
      // DashboardPicker asynchronously sets its internal state based on search results, causing warnings when testing.
      // Given we are not aware of the component implementation to wait on certain element to appear or disappear (for example a loading indicator),
      // we wait for the mocked promise we know it internally uses.
      // This is less than ideal as we are relying on implementation details, but is a reasonable solution for this test's scope
      await searchFoldersResponse;
    });
  };

  beforeEach(() => {
    jest.spyOn(dashboardApi, 'searchFolders').mockReturnValue(searchFoldersResponse);
    jest.spyOn(backendSrv, 'search').mockReturnValue(searchDashboardResponse);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Should switch form when changing save target', async () => {
    const saveMock = jest.fn();

    render(<AddToDashboardModal onSave={saveMock} onClose={() => {}} />);
    await waitForSearchFolderResponse();

    const newDashboardRadio = screen.getByRole<HTMLInputElement>('radio', { name: /new dashboard/i });
    const existingDashboardRadio = screen.getByRole<HTMLInputElement>('radio', { name: /existing dashboard/i });

    // NOTE: the following is definitely not the best way to test for changes in the form as ideally
    // we'd test for (at least some of) the elements that composes it.
    // Selects are not easy to "find" though and the label+description seems to be quite broken
    // from an a11y perspective, making it impossible to search for those elements with canonical methods
    // such as *byRole queries or even *byLabelText.

    // Save to new dashboard should be the default form
    expect(newDashboardRadio).toBeChecked();
    expect(existingDashboardRadio).not.toBeChecked();
    expect(screen.getByText(/create a new dashboard and add a panel with the explored queries./i)).toBeInTheDocument();
    expect(
      screen.queryByText(/add a panel with the explored queries to an existing dashboard./i)
    ).not.toBeInTheDocument();

    // Clicking on "Existing dashboard" radio should switch form
    userEvent.click(existingDashboardRadio);
    await waitForSearchDashboardResponse();
    expect(newDashboardRadio).not.toBeChecked();
    expect(existingDashboardRadio).toBeChecked();
    expect(
      screen.queryByText(/create a new dashboard and add a panel with the explored queries./i)
    ).not.toBeInTheDocument();
    expect(screen.getByText(/add a panel with the explored queries to an existing dashboard./i)).toBeInTheDocument();

    // Clicking on "New Dashboard" radio should switch back
    userEvent.click(newDashboardRadio);
    await waitForSearchFolderResponse();
    expect(newDashboardRadio).toBeChecked();
    expect(existingDashboardRadio).not.toBeChecked();
    expect(screen.getByText(/create a new dashboard and add a panel with the explored queries./i)).toBeInTheDocument();
    expect(
      screen.queryByText(/add a panel with the explored queries to an existing dashboard./i)
    ).not.toBeInTheDocument();
  });

  describe('Save to new dashboard', () => {
    describe('Form validation', () => {
      describe('Invalid form', () => {
        it('Does not submit if the name is missing', async () => {
          const saveMock = jest.fn();

          render(<AddToDashboardModal onSave={saveMock} onClose={() => {}} />);

          // there shouldn't be any alert in the modal
          expect(screen.queryByRole('alert')).not.toBeInTheDocument();

          const dashboardNameInput = screen.getByRole<HTMLInputElement>('textbox', { name: /dashboard name/i });

          // dashboard name is required (and it is trimmed)
          userEvent.clear(dashboardNameInput);
          userEvent.type(dashboardNameInput, '  ');

          userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

          // The error message should appear
          await screen.findByRole('alert');

          // Create dashboard API is not invoked
          expect(saveMock).not.toHaveBeenCalled();
        });

        it('Does not submit if the folder missing', async () => {
          // This covers cases in which users has no write access to any of the folders
          jest.spyOn(dashboardApi, 'searchFolders').mockReturnValue(Promise.resolve([]));

          const saveMock = jest.fn();

          render(<AddToDashboardModal onSave={saveMock} onClose={() => {}} />);

          // there shouldn't be any alert in the modal
          expect(screen.queryByRole('alert')).not.toBeInTheDocument();

          userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

          // The error message should appear
          await screen.findByRole('alert');

          // Create dashboard API is not invoked
          expect(saveMock).not.toHaveBeenCalled();
        });
      });

      it('Correctly submits if the form is valid', async () => {
        const saveMock = jest.fn();

        render(<AddToDashboardModal onSave={saveMock} onClose={() => {}} />);
        await waitForSearchFolderResponse();

        const dashboardNameInput = screen.getByRole<HTMLInputElement>('textbox', { name: /dashboard name/i });

        userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /save and keep exploring/i })).toBeEnabled();
        });

        expect(saveMock).toHaveBeenCalledWith(
          {
            dashboardName: dashboardNameInput.value,
            folderId: 1,
            saveTarget: 'new_dashboard',
          },
          expect.anything()
        );
      });
    });

    describe('Handling API errors', () => {
      beforeEach(() => jest.spyOn(dashboardApi, 'searchFolders').mockReturnValue(searchFoldersResponse));

      afterEach(() => jest.restoreAllMocks());

      it('Correctly handles name-exist API Error', async () => {
        // name-exists is triggered when trying to create a dashboard in a folder that already has a dashboard with the same name
        const saveMock = jest.fn().mockResolvedValue({ status: 'name-exists' });

        render(<AddToDashboardModal onSave={saveMock} onClose={() => {}} />);
        await waitForSearchFolderResponse();

        userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'A dashboard with the same name already exists in this folder.'
        );
      });

      it('Correctly handles empty name API Error', async () => {
        // empty-name is triggered when trying to create a dashboard having an empty name.
        // FE validation usually avoids this scenario, plus the input is automatically trimmed before validation.
        // leaving it here for completeness.
        const saveMock = jest.fn().mockResolvedValue({ status: 'empty-name' });

        render(<AddToDashboardModal onSave={saveMock} onClose={() => {}} />);
        await waitForSearchFolderResponse();

        await act(async () => {
          userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));
          await new Promise(process.nextTick);
        });

        expect(await screen.findByRole('alert')).toHaveTextContent('Dashboard name is required.');
      });

      it('Correctly handles name match API Error', async () => {
        // name-match, triggered when trying to create a dashboard in a folder that has the same name.
        // it doesn't seem to ever be triggered, but matches the error in
        // https://github.com/grafana/grafana/blob/44f1e381cbc7a5e236b543bc6bd06b00e3152d7f/pkg/models/dashboards.go#L71
        const saveMock = jest.fn().mockResolvedValue({ status: 'name-match' });

        render(<AddToDashboardModal onSave={saveMock} onClose={() => {}} />);
        await waitForSearchFolderResponse();

        userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
          "Dashboard name cannot be the same as its folder's name."
        );
      });

      it('Correctly handles unknown API errors that return descriptive messages', async () => {
        const saveMock = jest.fn().mockResolvedValueOnce({ status: 'unknown-error', message: 'unknown error' });

        render(<AddToDashboardModal onSave={saveMock} onClose={() => {}} />);
        await waitForSearchFolderResponse();

        userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent('unknown error');
      });

      it('Correctly handles unknown API', async () => {
        const saveMock = jest.fn().mockResolvedValueOnce({ status: 'unknown-error' });

        render(<AddToDashboardModal onSave={saveMock} onClose={() => {}} />);
        await waitForSearchFolderResponse();

        userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'An unknown error occurred while saving the dashboard. Please try again.'
        );
      });
    });
  });
});
