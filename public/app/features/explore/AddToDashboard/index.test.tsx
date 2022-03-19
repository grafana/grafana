import React from 'react';
import { act, render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { ExploreId, ExplorePanelData, ExploreState } from 'app/types';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import userEvent from '@testing-library/user-event';
import { DataQuery, MutableDataFrame } from '@grafana/data';
import { createEmptyQueryResponse } from '../state/utils';
import { locationService } from '@grafana/runtime';
import { DashboardSearchHit, DashboardSearchItemType } from 'app/features/search/types';
import * as api from './addToDashboard';
import * as dashboardApi from 'app/features/manage-dashboards/state/actions';
import { AddToDashboard } from '.';

const setup = (
  children: JSX.Element,
  queries: DataQuery[] = [],
  queryResponse: ExplorePanelData = createEmptyQueryResponse()
) => {
  const store = configureStore({
    explore: {
      left: {
        queries,
        queryResponse,
        datasourceInstance: {
          type: 'loki',
          uid: 'someuid',
        },
      },
    } as ExploreState,
  });

  return render(<Provider store={store}>{children}</Provider>);
};

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

const openModal = async () => {
  userEvent.click(screen.getByRole('button', { name: /add to dashboard/i }));

  expect(await screen.findByRole('dialog', { name: 'Add panel to dashboard' })).toBeInTheDocument();
};

describe('Add to Dashboard Button', () => {
  const searchFoldersResponse = Promise.resolve([createFolder('Folder 1', 1), createFolder('Folder 2', 2)]);
  const redirectURL = '/some/redirect/url';
  let addToDashboardMock: jest.SpyInstance<
    ReturnType<typeof api.addToDashboard>,
    Parameters<typeof api.addToDashboard>
  >;

  const waitForSearchFolderResponse = async () => {
    return act(async () => {
      await searchFoldersResponse;
    });
  };

  beforeEach(() => {
    jest.spyOn(dashboardApi, 'searchFolders').mockReturnValue(searchFoldersResponse);
    // TODO: name should be the same passed to `addToDashboard`
    addToDashboardMock = jest.spyOn(api, 'addToDashboard').mockImplementation((data) =>
      Promise.resolve({
        name: data.saveTarget === 'new_dashboard' ? data.dashboardName : 'Some Existing Dashboard Name',
        url: '/some/redirect/url',
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Opens and closes the modal correctly', async () => {
    setup(<AddToDashboard exploreId={ExploreId.left} />, [{ refId: 'A' }]);

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('navigation', () => {
    it('Navigates to dashboard when clicking on "Save and go to dashboard"', async () => {
      locationService.push = jest.fn();

      setup(<AddToDashboard exploreId={ExploreId.left} />, [{ refId: 'A' }]);

      await openModal();

      userEvent.click(screen.getByRole('button', { name: /save and go to dashboard/i }));

      await waitForSearchFolderResponse();

      expect(locationService.push).toHaveBeenCalledWith(redirectURL);
    });

    it('Does NOT navigate to dashboard when clicking on "Save and keep exploring"', async () => {
      locationService.push = jest.fn();

      setup(<AddToDashboard exploreId={ExploreId.left} />, [{ refId: 'A' }]);

      await openModal();

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      await waitForSearchFolderResponse();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      expect(locationService.push).not.toHaveBeenCalled();
    });
  });

  it('Correct datasource ref is used', async () => {
    setup(<AddToDashboard exploreId={ExploreId.left} />, [{ refId: 'A' }]);

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Add panel to dashboard' }));

    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        datasource: {
          type: 'loki',
          uid: 'someuid',
        },
      })
    );
  });

  it('All queries are correctly passed through', async () => {
    const queries: DataQuery[] = [{ refId: 'A' }, { refId: 'B', hide: true }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries);

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Add panel to dashboard' }));

    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        queries: queries,
      })
    );
  });

  it('Defaults to table if no response is available', async () => {
    const queries: DataQuery[] = [{ refId: 'A' }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries, createEmptyQueryResponse());

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Add panel to dashboard' }));

    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        panel: 'table',
      })
    );
  });

  it('Defaults to table if no query is active', async () => {
    const queries: DataQuery[] = [{ refId: 'A', hide: true }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries);

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Add panel to dashboard' }));

    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        panel: 'table',
      })
    );
  });

  it('Filters out hidden queries when selecting visualization', async () => {
    const queries: DataQuery[] = [{ refId: 'A', hide: true }, { refId: 'B' }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries, {
      ...createEmptyQueryResponse(),
      graphFrames: [new MutableDataFrame({ refId: 'B', fields: [] })],
      logsFrames: [new MutableDataFrame({ refId: 'A', fields: [] })],
    });

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Add panel to dashboard' }));

    // Query A comes before B, but it's hidden. visualization will be picked according to frames generated by B
    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        queries: queries,
        panel: 'timeseries',
      })
    );
  });

  it('Sets visualization to logs if there are log frames', async () => {
    const queries: DataQuery[] = [{ refId: 'A' }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries, {
      ...createEmptyQueryResponse(),
      logsFrames: [new MutableDataFrame({ refId: 'A', fields: [] })],
    });

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Add panel to dashboard' }));

    // Query A comes before B, but it's hidden. visualization will be picked according to frames generated by B
    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        panel: 'logs',
      })
    );
  });

  it('Sets visualization to timeseries if there are graph frames', async () => {
    const queries: DataQuery[] = [{ refId: 'A' }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries, {
      ...createEmptyQueryResponse(),
      graphFrames: [new MutableDataFrame({ refId: 'A', fields: [] })],
    });

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Add panel to dashboard' }));

    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        panel: 'timeseries',
      })
    );
  });

  it('Sets visualization to nodeGraph if there are node graph frames', async () => {
    const queries: DataQuery[] = [{ refId: 'A' }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries, {
      ...createEmptyQueryResponse(),
      nodeGraphFrames: [new MutableDataFrame({ refId: 'A', fields: [] })],
    });

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Add panel to dashboard' }));

    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        panel: 'nodeGraph',
      })
    );
  });

  // trace view is not supported in dashboards, defaulting to table
  it('Sets visualization to table if there are trace frames', async () => {
    const queries: DataQuery[] = [{ refId: 'A' }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries, {
      ...createEmptyQueryResponse(),
      traceFrames: [new MutableDataFrame({ refId: 'A', fields: [] })],
    });

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Add panel to dashboard' }));

    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        panel: 'table',
      })
    );
  });
});
