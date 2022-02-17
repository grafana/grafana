import React from 'react';
import { render, screen, act, waitForElementToBeRemoved } from '@testing-library/react';
import { AddToDashboardButton } from './AddToDashboardButton';
import userEvent from '@testing-library/user-event';
import * as dashboardApi from 'app/features/manage-dashboards/state/actions';
import * as api from './addToDashboard';
import { DashboardSearchHit, DashboardSearchItemType } from 'app/features/search/types';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { locationService } from '@grafana/runtime';

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

const openModal = async () => {
  userEvent.click(screen.getByRole('button', { name: /add to dashboard/i }));

  return act(async () => {
    // FolderPicker asyncrounously sets its internal state based on search results, causing ugly warnings when testing.
    // Given we are not aware of the component implementation to wait on certain element to appear or disappear (for example a loading indicator),
    // we wait for the mocked promise we know it internally uses.
    // This is less than ideal as we are relying on implementation details, but is a reasonable solution for this test's scope
    await foldersSearchPromise;
  });
};

describe('Add to Dashboard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('navigation', () => {
    jest
      .spyOn(api, 'addToDashboard')
      .mockImplementation(() => Promise.resolve(createFetchResponse({ url: '/dashboard/1' })));
    locationService.push = jest.fn();

    it('Navigates to dashboard when clicking on "Save and go to dashboard"', async () => {
      render(<AddToDashboardButton queries={[]} visualization="table" />);

      await openModal();

      userEvent.click(screen.getByRole('button', { name: /save and go to dashboard/i }));

      await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

      expect(locationService.push).toHaveBeenCalledWith('/dashboard/1');
    });

    it('Does NOT navigate to dashboard when clicking on "Save and keep exploring"', async () => {
      render(<AddToDashboardButton queries={[]} visualization="table" />);

      await openModal();

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

      expect(locationService.push).not.toHaveBeenCalled();
    });
  });

  it('Opens and closes the modal correctly', async () => {
    render(<AddToDashboardButton queries={[]} visualization="table" />);

    await openModal();

    // waiting on https://github.com/grafana/grafana/pull/45472 to properly test this:
    // expect(screen.getByRole('dialog', { name: 'Add query to dashboard' })).toBeInTheDocument();
    // expect(screen.getByLabelText('Add query to dashboard')).toBeInTheDocument();
    expect(screen.getByText('Add query to dashboard')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // TODO: once https://github.com/grafana/grafana/pull/45472 is merged replace with
    // expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Add query to dashboard')).not.toBeInTheDocument();
  });

  describe('Save to new dashboard', () => {
    it('Does not submit if the form is invalid', async () => {
      const addToDashboard = jest
        .spyOn(api, 'addToDashboard')
        .mockImplementation(() => Promise.resolve(createFetchResponse({})));

      render(<AddToDashboardButton queries={[]} visualization="table" />);

      await openModal();

      // there shouldn't be any alert in the modal
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      const dashboardNameInput = screen.getByRole<HTMLInputElement>('textbox', { name: /dashboard name/i });

      // dashboard name is required
      userEvent.clear(dashboardNameInput);

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      // The error message should appear
      await screen.findByRole('alert');

      // The modal should not get closed
      expect(screen.queryByText('Add query to dashboard')).toBeInTheDocument();

      // Create dashboard API is not invoked
      expect(addToDashboard).not.toHaveBeenCalled();
    });

    it('Correctly submits if the form is valid', async () => {
      const addToDashboard = jest
        .spyOn(api, 'addToDashboard')
        .mockImplementation(() => Promise.resolve(createFetchResponse({})));

      render(<AddToDashboardButton queries={[]} visualization="table" />);

      await openModal();

      const dashboardNameInput = screen.getByRole<HTMLInputElement>('textbox', { name: /dashboard name/i });

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

      expect(addToDashboard).toHaveBeenCalledWith({
        dashboardName: dashboardNameInput.value,
        queries: [],
        visualization: 'table',
        folder: expect.objectContaining({ id: 0 }),
      });
    });
  });

  describe('API errors', () => {
    it('Correctly sets error related to dashboard name', async () => {
      const spy = jest.spyOn(api, 'addToDashboard');

      render(<AddToDashboardButton queries={[]} visualization="table" />);

      await openModal();

      // name-exists, triggered when trying to create a dashboard in a folder that already has a dashboard with the same name
      spy.mockImplementation(() =>
        Promise.reject(createFetchResponse({ status: 'name-exists', message: 'name exists' }))
      );

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      await screen.findByRole('alert');
      expect(await screen.findByRole('alert')).toHaveTextContent('name exists');

      // empty-name, triggered when trying to create a dashboard having an empty name.
      // FE validation usually avoids this use case, but can be triggered by using only whitespaces in
      // dashboard name field
      spy.mockImplementation(() =>
        Promise.reject(createFetchResponse({ status: 'empty-name', message: 'empty name' }))
      );

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      await screen.findByRole('alert');
      expect(await screen.findByRole('alert')).toHaveTextContent('empty name');

      // name-match, triggered when trying to create a dashboard in a folder that has the same name.
      // it doesn't seem to ever be triggered, but matches the error in
      // https://github.com/grafana/grafana/blob/44f1e381cbc7a5e236b543bc6bd06b00e3152d7f/pkg/models/dashboards.go#L71
      spy.mockImplementation(() =>
        Promise.reject(createFetchResponse({ status: 'name-match', message: 'name match' }))
      );

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      await screen.findByRole('alert');
      expect(await screen.findByRole('alert')).toHaveTextContent('name match');
    });
  });
});
