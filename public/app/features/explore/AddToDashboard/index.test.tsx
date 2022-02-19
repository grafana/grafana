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
  const store = configureStore({ explore: { left: { queries, queryResponse } } as ExploreState });

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

  // waiting on https://github.com/grafana/grafana/pull/45472 to properly test this:
  // expect(await screen.findByText('dialog', { name: 'Add query to dashboard' })).toBeInTheDocument();
  expect(await screen.findByText('Add query to dashboard')).toBeInTheDocument();
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
    addToDashboardMock = jest.spyOn(api, 'addToDashboard').mockResolvedValue('/some/redirect/url');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Opens and closes the modal correctly', async () => {
    setup(<AddToDashboard exploreId={ExploreId.left} />);

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // TODO: once https://github.com/grafana/grafana/pull/45472 is merged replace with
    // expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Add query to dashboard')).not.toBeInTheDocument();
  });

  describe('navigation', () => {
    it('Navigates to dashboard when clicking on "Save and go to dashboard"', async () => {
      locationService.push = jest.fn();

      setup(<AddToDashboard exploreId={ExploreId.left} />);

      await openModal();

      userEvent.click(screen.getByRole('button', { name: /save and go to dashboard/i }));

      await waitForSearchFolderResponse();

      expect(locationService.push).toHaveBeenCalledWith(redirectURL);
    });

    it('Does NOT navigate to dashboard when clicking on "Save and keep exploring"', async () => {
      locationService.push = jest.fn();

      setup(<AddToDashboard exploreId={ExploreId.left} />);

      await openModal();

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      await waitForSearchFolderResponse();

      // TODO: once https://github.com/grafana/grafana/pull/45472 is merged replace with
      // expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Add query to dashboard')).not.toBeInTheDocument();

      expect(locationService.push).not.toHaveBeenCalled();
    });
  });

  it('All queries are correctly passed through', async () => {
    const queries: DataQuery[] = [{ refId: 'A' }, { refId: 'B', hide: true }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries);

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    expect(addToDashboardMock).toHaveBeenCalledWith(
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

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visualization: 'table',
      })
    );
  });

  it('Defaults to table if no query is active', async () => {
    const queries: DataQuery[] = [{ refId: 'A', hide: true }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries);

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visualization: 'table',
      })
    );
  });

  it('Defaults to table if no query', async () => {
    setup(<AddToDashboard exploreId={ExploreId.left} />, []);

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visualization: 'table',
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

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    // Query A comes before B, but it's hidden. visualization will be picked according to frames generated by B
    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: queries,
        visualization: 'timeseries',
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

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    // Query A comes before B, but it's hidden. visualization will be picked according to frames generated by B
    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visualization: 'logs',
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

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visualization: 'timeseries',
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

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visualization: 'nodeGraph',
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

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    expect(addToDashboardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visualization: 'table',
      })
    );
  });
});
