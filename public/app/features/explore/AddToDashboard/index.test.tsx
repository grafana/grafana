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
import * as appNotification from 'app/core/copy/appNotification';
import { AddToDashboard } from '.';

const setup = (children: JSX.Element, queries: DataQuery[] = [], queryResponse?: ExplorePanelData) => {
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

    addToDashboardMock = jest.spyOn(api, 'addToDashboard').mockImplementation((data) =>
      Promise.resolve({
        name: data.saveTarget === 'new_dashboard' ? data.dashboardName : data.dashboard.title,
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

  describe('Navigation & success notifications', () => {
    const successMock = jest.fn();

    beforeEach(() => {
      jest
        .spyOn(appNotification, 'useAppNotification')
        .mockReturnValue({ success: successMock, error: jest.fn(), warning: jest.fn() });
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('Does NOT navigate to dashboard when clicking on "Save and keep exploring"', async () => {
      locationService.push = jest.fn();
      const successMock = jest.fn();
      jest
        .spyOn(appNotification, 'useAppNotification')
        .mockReturnValue({ success: successMock, error: jest.fn(), warning: jest.fn() });

      setup(<AddToDashboard exploreId={ExploreId.left} />, [{ refId: 'A' }]);

      await openModal();

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      await waitForSearchFolderResponse();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      expect(locationService.push).not.toHaveBeenCalled();
      expect(successMock).toHaveBeenCalledWith('Panel saved to New dashboard (Explore)');
    });

    it('Navigates to dashboard when clicking on "Save and go to dashboard"', async () => {
      locationService.push = jest.fn();

      setup(<AddToDashboard exploreId={ExploreId.left} />, [{ refId: 'A' }]);

      await openModal();

      userEvent.click(screen.getByRole('button', { name: /save and go to dashboard/i }));

      await waitForSearchFolderResponse();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(locationService.push).toHaveBeenCalledWith(redirectURL);
      expect(successMock).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    const successMock = jest.fn();

    beforeEach(() => {
      jest
        .spyOn(appNotification, 'useAppNotification')
        .mockReturnValue({ success: successMock, error: jest.fn(), warning: jest.fn() });
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    const cases = [undefined, {}, { data: {} }, { data: { status: 'some-status' } }];
    it.each(cases)('Handles errors in the form of %o', async (error) => {
      addToDashboardMock.mockImplementationOnce(() => Promise.reject(error));

      setup(<AddToDashboard exploreId={ExploreId.left} />, [{ refId: 'A' }]);

      await openModal();

      userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

      await waitForSearchFolderResponse();

      expect(screen.queryByRole('dialog')).toBeInTheDocument();

      expect(locationService.push).not.toHaveBeenCalled();
      expect(successMock).not.toHaveBeenCalled();
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
        queries,
      })
    );
  });

  describe('Setting visualization type', () => {
    describe('Defaults to table', () => {
      const cases: Array<[string, DataQuery[], ExplorePanelData | undefined]> = [
        ['If no response is available', [{ refId: 'A' }], undefined],
        ['If response is empty', [{ refId: 'A' }], createEmptyQueryResponse()],
        ['If no query is active', [{ refId: 'A', hide: true }], undefined],
        [
          'If no query is active, even when there is a response from a previous execution',
          [{ refId: 'A', hide: true }],
          { ...createEmptyQueryResponse(), logsFrames: [new MutableDataFrame({ refId: 'A', fields: [] })] },
        ],
        [
          // trace view is not supported in dashboards, we expect to fallback to table panel
          'If there are trace frames',
          [{ refId: 'A' }],
          { ...createEmptyQueryResponse(), traceFrames: [new MutableDataFrame({ refId: 'A', fields: [] })] },
        ],
      ];

      it.each(cases)('%s', async (_, queries, queryResponse) => {
        setup(<AddToDashboard exploreId={ExploreId.left} />, queries, queryResponse);

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

    describe('Correctly set visualization based on response', () => {
      type TestArgs = {
        framesType: string;
        expectedPanel: string;
      };
      // Note: traceFrames test is "duplicated" in "Defaults to table" tests.
      // This is intentional as a way to enforce explicit tests for that case whenever in the future we'll
      // add support for creating traceview panels
      it.each`
        framesType           | expectedPanel
        ${'logsFrames'}      | ${'logs'}
        ${'graphFrames'}     | ${'timeseries'}
        ${'nodeGraphFrames'} | ${'nodeGraph'}
        ${'traceFrames'}     | ${'table'}
      `(
        'Sets visualization to $expectedPanel if there are $frameType frames',
        async ({ framesType, expectedPanel }: TestArgs) => {
          const queryResponse: ExplorePanelData = {
            ...createEmptyQueryResponse(),
            [framesType]: [new MutableDataFrame({ refId: 'A', fields: [] })],
          };
          setup(<AddToDashboard exploreId={ExploreId.left} />, [{ refId: 'A' }], queryResponse);

          await openModal();

          userEvent.click(screen.getByRole('button', { name: /save and keep exploring/i }));

          await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Add panel to dashboard' }));

          expect(addToDashboardMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              panel: expectedPanel,
            })
          );
        }
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
  });
});
