import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { selectors } from '@grafana/e2e-selectors';
import config from 'app/core/config';
import * as api from 'app/features/manage-dashboards/state/actions';

import { DashboardSearchHit, DashboardSearchItemType } from '../../types';

import { MoveToFolderModal } from './MoveToFolderModal';

function makeSelections(dashboardUIDs: string[] = [], folderUIDs: string[] = []) {
  const dashboards = new Set(dashboardUIDs);
  const folders = new Set(folderUIDs);

  return new Map([
    ['dashboard', dashboards],
    ['folder', folders],
  ]);
}

function makeDashboardSearchHit(title: string, uid: string, type = DashboardSearchItemType.DashDB): DashboardSearchHit {
  return { title, uid, tags: [], type, url: `/d/${uid}` };
}

describe('MoveToFolderModal', () => {
  jest
    .spyOn(api, 'searchFolders')
    .mockResolvedValue([
      makeDashboardSearchHit('General', '', DashboardSearchItemType.DashFolder),
      makeDashboardSearchHit('Folder 1', 'folder-uid-1', DashboardSearchItemType.DashFolder),
      makeDashboardSearchHit('Folder 2', 'folder-uid-1', DashboardSearchItemType.DashFolder),
      makeDashboardSearchHit('Folder 3', 'folder-uid-3', DashboardSearchItemType.DashFolder),
    ]);

  it('should render correct title, body, dismiss-, cancel- and move-text', async () => {
    const items = makeSelections(['dash-uid-1', 'dash-uid-2']);

    const mockStore = configureMockStore();
    const store = mockStore({ dashboard: { panels: [] } });
    const onMoveItems = jest.fn();

    render(
      <Provider store={store}>
        <MoveToFolderModal onMoveItems={onMoveItems} results={items} onDismiss={() => {}} />
      </Provider>
    );

    // Wait for folder picker to finish rendering
    await screen.findByText('Choose');

    expect(screen.getByRole('heading', { name: 'Choose Dashboard Folder' })).toBeInTheDocument();
    expect(screen.getByText('Move 2 dashboards to:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
  });

  it('should move dashboards, but not folders', async () => {
    const moveDashboardsMock = jest.spyOn(api, 'moveDashboards').mockResolvedValue({
      successCount: 2,
      totalCount: 2,
      alreadyInFolderCount: 0,
    });

    const moveFoldersMock = jest.spyOn(api, 'moveFolders').mockResolvedValue({
      successCount: 1,
      totalCount: 1,
    });

    const items = makeSelections(['dash-uid-1', 'dash-uid-2'], ['folder-uid-1']);

    const mockStore = configureMockStore();
    const store = mockStore({ dashboard: { panels: [] } });
    const onMoveItems = jest.fn();

    render(
      <Provider store={store}>
        <MoveToFolderModal onMoveItems={onMoveItems} results={items} onDismiss={() => {}} />
      </Provider>
    );

    // Wait for folder picker to finish rendering
    await screen.findByText('Choose');

    const folderPicker = screen.getByLabelText(selectors.components.FolderPicker.input);
    await selectOptionInTest(folderPicker, 'Folder 3');

    const moveButton = screen.getByText('Move');
    await userEvent.click(moveButton);

    expect(moveDashboardsMock).toHaveBeenCalledWith(['dash-uid-1', 'dash-uid-2'], {
      title: 'Folder 3',
      uid: 'folder-uid-3',
    });

    expect(moveFoldersMock).not.toHaveBeenCalled();
  });

  describe('with nestedFolders feature flag', () => {
    let originalNestedFoldersValue = config.featureToggles.nestedFolders;

    beforeAll(() => {
      originalNestedFoldersValue = config.featureToggles.nestedFolders;
      config.featureToggles.nestedFolders = true;
    });

    afterAll(() => {
      config.featureToggles.nestedFolders = originalNestedFoldersValue;
    });

    it('should move folders and dashboards', async () => {
      const moveDashboardsMock = jest.spyOn(api, 'moveDashboards').mockResolvedValue({
        successCount: 2,
        totalCount: 2,
        alreadyInFolderCount: 0,
      });

      const moveFoldersMock = jest.spyOn(api, 'moveFolders').mockResolvedValue({
        successCount: 1,
        totalCount: 1,
      });

      const items = makeSelections(['dash-uid-1', 'dash-uid-2'], ['folder-uid-1']);

      const mockStore = configureMockStore();
      const store = mockStore({ dashboard: { panels: [] } });
      const onMoveItems = jest.fn();

      render(
        <Provider store={store}>
          <MoveToFolderModal onMoveItems={onMoveItems} results={items} onDismiss={() => {}} />
        </Provider>
      );

      // Wait for folder picker to finish rendering
      await screen.findByText('Choose');

      const folderPicker = screen.getByLabelText(selectors.components.FolderPicker.input);
      await selectOptionInTest(folderPicker, 'Folder 3');

      const moveButton = screen.getByRole('button', { name: 'Move' });
      await userEvent.click(moveButton);

      expect(moveDashboardsMock).toHaveBeenCalledWith(['dash-uid-1', 'dash-uid-2'], {
        title: 'Folder 3',
        uid: 'folder-uid-3',
      });

      expect(moveFoldersMock).toHaveBeenCalledWith(['folder-uid-1'], {
        title: 'Folder 3',
        uid: 'folder-uid-3',
      });
    });
  });
});
