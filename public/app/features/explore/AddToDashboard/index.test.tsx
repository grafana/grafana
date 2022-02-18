import React from 'react';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { AddToDashboard } from '.';
import { ExploreId, ExplorePanelData } from 'app/types';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import { openModal } from './__test__/utils';
import * as api from './addToDashboard';
import userEvent from '@testing-library/user-event';
import { DataQuery, MutableDataFrame } from '@grafana/data';
import { createEmptyQueryResponse } from '../state/utils';
import { locationService } from '@grafana/runtime';

const setup = (children: JSX.Element, queries: DataQuery[], queryResponse: ExplorePanelData) => {
  const store = configureStore({ explore: { left: { queries, queryResponse } } });

  return render(<Provider store={store}>{children}</Provider>);
};

describe('Add to Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('navigation', () => {
    jest.spyOn(api, 'addToDashboard').mockImplementation(() => Promise.resolve('/dashboard/1'));

    it('Navigates to dashboard when clicking on "Save and go to dashboard"', async () => {
      locationService.push = jest.fn();

      setup(<AddToDashboard exploreId={ExploreId.left} />, [], createEmptyQueryResponse());

      await openModal();

      userEvent.click(screen.getByRole('button', { name: /save and go to dashboard/i }));

      await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

      expect(locationService.push).toHaveBeenCalledWith('/dashboard/1');
    });

    it('Does NOT navigate to dashboard when clicking on "Save and keep exploring"', async () => {
      locationService.push = jest.fn();

      setup(<AddToDashboard exploreId={ExploreId.left} />, [], createEmptyQueryResponse());

      await openModal();

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

      expect(locationService.push).not.toHaveBeenCalled();
    });
  });

  it('All queries are correctly passed through', async () => {
    // TODO: move the save logic in DashboardSrv and test against it instead
    const addToDashboard = jest.spyOn(api, 'addToDashboard');

    const queries: DataQuery[] = [{ refId: 'A' }, { refId: 'B', hide: true }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries, createEmptyQueryResponse());

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    expect(addToDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: queries,
      })
    );
  });

  it('Defaults to table if no response is available', async () => {
    const addToDashboard = jest.spyOn(api, 'addToDashboard');

    const queries: DataQuery[] = [{ refId: 'A' }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries, createEmptyQueryResponse());

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    expect(addToDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        visualization: 'table',
      })
    );
  });

  it('Defaults to table if no query is active', async () => {
    const addToDashboard = jest.spyOn(api, 'addToDashboard');

    const queries: DataQuery[] = [{ refId: 'A', hide: true }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries, createEmptyQueryResponse());

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    expect(addToDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        visualization: 'table',
      })
    );
  });

  it('Defaults to table if no query', async () => {
    const addToDashboard = jest.spyOn(api, 'addToDashboard');

    setup(<AddToDashboard exploreId={ExploreId.left} />, [], createEmptyQueryResponse());

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    expect(addToDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        visualization: 'table',
      })
    );
  });

  it('Filters out hidden queries when selecting visualization', async () => {
    const addToDashboard = jest.spyOn(api, 'addToDashboard');

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
    expect(addToDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: queries,
        visualization: 'timeseries',
      })
    );
  });

  it('Set visualization to logs if there are log frames', async () => {
    const addToDashboard = jest.spyOn(api, 'addToDashboard');

    const queries: DataQuery[] = [{ refId: 'A' }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries, {
      ...createEmptyQueryResponse(),
      logsFrames: [new MutableDataFrame({ refId: 'A', fields: [] })],
    });

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    // Query A comes before B, but it's hidden. visualization will be picked according to frames generated by B
    expect(addToDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        visualization: 'logs',
      })
    );
  });

  it('Set visualization to timeseries if there are graph frames', async () => {
    const addToDashboard = jest.spyOn(api, 'addToDashboard');

    const queries: DataQuery[] = [{ refId: 'A' }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries, {
      ...createEmptyQueryResponse(),
      graphFrames: [new MutableDataFrame({ refId: 'A', fields: [] })],
    });

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    expect(addToDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        visualization: 'timeseries',
      })
    );
  });

  it('Set visualization to nodeGraph if there are node graph frames', async () => {
    const addToDashboard = jest.spyOn(api, 'addToDashboard');

    const queries: DataQuery[] = [{ refId: 'A' }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries, {
      ...createEmptyQueryResponse(),
      nodeGraphFrames: [new MutableDataFrame({ refId: 'A', fields: [] })],
    });

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    expect(addToDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        visualization: 'nodeGraph',
      })
    );
  });

  it('Set visualization to table if there are trace frames', async () => {
    // trace view is not supported in dashboards, defaulting to table
    const addToDashboard = jest.spyOn(api, 'addToDashboard');

    const queries: DataQuery[] = [{ refId: 'A' }];
    setup(<AddToDashboard exploreId={ExploreId.left} />, queries, {
      ...createEmptyQueryResponse(),
      traceFrames: [new MutableDataFrame({ refId: 'A', fields: [] })],
    });

    await openModal();

    userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

    await waitForElementToBeRemoved(() => screen.queryByText('Add query to dashboard'));

    expect(addToDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        visualization: 'table',
      })
    );
  });
});
