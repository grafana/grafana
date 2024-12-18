import { Props } from 'react-virtualized-auto-sizer';

import { EventBusSrv, serializeStateToUrlParam } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import store from 'app/core/store';

import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';
import * as localStorage from '../../../core/history/RichHistoryLocalStorage';

import {
  assertDataSourceFilterVisibility,
  assertLoadMoreQueryHistoryNotVisible,
  assertQueryHistory,
  assertQueryHistoryComment,
  assertQueryHistoryElementsShown,
  assertQueryHistoryExists,
  assertQueryHistoryIsEmpty,
  assertQueryHistoryTabIsSelected,
} from './helper/assert';
import {
  closeQueryHistory,
  commentQueryHistory,
  deleteQueryHistory,
  inputQuery,
  loadMoreQueryHistory,
  openQueryHistory,
  runQuery,
  selectOnlyActiveDataSource,
  selectStarredTabFirst,
  switchToQueryHistoryTab,
} from './helper/interactions';
import { makeLogsQueryResponse } from './helper/query';
import { setupExplore, tearDown, waitForExplore } from './helper/setup';

const reportInteractionMock = jest.fn();
const testEventBus = new EventBusSrv();

interface MockQuery extends DataQuery {
  expr: string;
}

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: (...args: object[]) => {
    reportInteractionMock(...args);
  },
  getAppEvents: () => testEventBus,
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasPermission: () => true,
    isSignedIn: true,
    getValidIntervals: (defaultIntervals: string[]) => defaultIntervals,
    user: {
      isSignedIn: true,
    },
  },
}));

jest.mock('app/core/services/PreferencesService', () => ({
  PreferencesService: function () {
    return {
      patch: jest.fn(),
      load: jest.fn().mockResolvedValue({
        queryHistory: {
          homeTab: 'query',
        },
      }),
    };
  },
}));

jest.mock('../hooks/useExplorePageTitle', () => ({
  useExplorePageTitle: jest.fn(),
}));

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    __esModule: true,
    default(props: Props) {
      return <div>{props.children({ height: 1, scaledHeight: 1, scaledWidth: 1000, width: 1000 })}</div>;
    },
  };
});

describe('Explore: Query History', () => {
  const USER_INPUT = 'my query';
  const RAW_QUERY = `{"expr":"${USER_INPUT}"}`;

  silenceConsoleOutput();

  afterEach(() => {
    config.queryHistoryEnabled = false;
    reportInteractionMock.mockClear();
    tearDown();
  });

  it('adds new query history items after the query is run.', async () => {
    // when Explore is opened
    const { datasources, unmount } = setupExplore({
      withAppChrome: true,
    });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
    await waitForExplore();

    // and a user runs a query and opens query history
    await inputQuery(USER_INPUT);
    await runQuery();
    await openQueryHistory();

    // the query that was run is in query history
    await assertQueryHistoryExists(RAW_QUERY);

    // when Explore is opened again
    unmount();

    tearDown({ clearLocalStorage: false });
    setupExplore({ clearLocalStorage: false, withAppChrome: true });
    await waitForExplore();

    // previously added query is in query history
    await openQueryHistory();
    await assertQueryHistoryExists(RAW_QUERY);

    expect(reportInteractionMock).toBeCalledWith('grafana_explore_query_history_opened', {
      queryHistoryEnabled: false,
    });
  });

  it('adds recently added query if the query history panel is already open', async () => {
    const urlParams = {
      left: serializeStateToUrlParam({
        datasource: 'loki',
        queries: [{ refId: 'A', expr: 'query #1' }],
        range: { from: 'now-1h', to: 'now' },
      }),
    };

    const { datasources } = setupExplore({
      urlParams,
      withAppChrome: true,
    });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
    await waitForExplore();
    await openQueryHistory();

    await inputQuery('query #2');
    await runQuery();
    await assertQueryHistory(['{"expr":"query #2"}', '{"expr":"query #1"}']);
  });

  it('does not add query if quota exceeded error is reached', async () => {
    const urlParams = {
      left: serializeStateToUrlParam({
        datasource: 'loki',
        queries: [{ refId: 'A', expr: 'query #1' }],
        range: { from: 'now-1h', to: 'now' },
      }),
    };

    const { datasources } = setupExplore({
      urlParams,
      withAppChrome: true,
    });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
    await waitForExplore();
    await openQueryHistory();

    const storeSpy = jest.spyOn(store, 'setObject').mockImplementation(() => {
      const error = new Error('QuotaExceededError');
      error.name = 'QuotaExceededError';
      throw error;
    });

    await inputQuery('query #2');
    await runQuery();
    await assertQueryHistory(['{"expr":"query #1"}']);
    storeSpy.mockRestore();
  });

  it('does add query if limit exceeded error is reached', async () => {
    const urlParams = {
      left: serializeStateToUrlParam({
        datasource: 'loki',
        queries: [{ refId: 'A', expr: 'query #1' }],
        range: { from: 'now-1h', to: 'now' },
      }),
    };

    const { datasources } = setupExplore({
      urlParams,
      withAppChrome: true,
    });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
    await waitForExplore();
    await openQueryHistory();

    jest.spyOn(localStorage, 'checkLimits').mockImplementationOnce((queries) => {
      return { queriesToKeep: queries, limitExceeded: true };
    });

    await inputQuery('query #2');
    await runQuery();
    await assertQueryHistory(['{"expr":"query #2"}', '{"expr":"query #1"}']);
  });

  it('add comments to query history', async () => {
    const urlParams = {
      left: serializeStateToUrlParam({
        datasource: 'loki',
        queries: [{ refId: 'A', expr: 'query #1' }],
        range: { from: 'now-1h', to: 'now' },
      }),
    };

    const { datasources } = setupExplore({
      urlParams,
      withAppChrome: true,
    });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
    await waitForExplore();
    await openQueryHistory();
    await assertQueryHistory(['{"expr":"query #1"}']);
    await commentQueryHistory(0, 'test comment');
    await assertQueryHistoryComment(['test comment']);
  });

  it('removes the query item from the history panel when user deletes a regular query', async () => {
    const urlParams = {
      left: serializeStateToUrlParam({
        datasource: 'loki',
        queries: [{ refId: 'A', expr: 'query #1' }],
        range: { from: 'now-1h', to: 'now' },
      }),
    };

    const { datasources } = setupExplore({
      urlParams,
      withAppChrome: true,
    });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());

    await waitForExplore();
    await openQueryHistory();

    // queries in history
    await assertQueryHistory(['{"expr":"query #1"}']);

    // delete query
    await deleteQueryHistory(0);

    // there was only one query in history so assert that query history is empty
    await assertQueryHistoryIsEmpty();
  });

  it('updates query history settings', async () => {
    // open settings page
    setupExplore({
      withAppChrome: true,
    });
    await waitForExplore();
    await openQueryHistory();

    // assert default values
    assertQueryHistoryTabIsSelected('Query history');
    assertDataSourceFilterVisibility(true);
    await switchToQueryHistoryTab('Settings');

    // change settings
    await selectStarredTabFirst();
    await selectOnlyActiveDataSource();
    await closeQueryHistory();
    await openQueryHistory();

    // assert new settings
    assertQueryHistoryTabIsSelected('Starred');
    assertDataSourceFilterVisibility(false);
  });

  it('pagination', async () => {
    config.queryHistoryEnabled = true;

    const mockQuery: MockQuery = { refId: 'A', expr: 'query' };
    const { datasources } = setupExplore({
      queryHistory: {
        queryHistory: [{ datasourceUid: 'loki', queries: [mockQuery] }],
        totalCount: 2,
      },
      withAppChrome: true,
    });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
    await waitForExplore();

    await openQueryHistory();
    await assertQueryHistory(['{"expr":"query"}']);
    assertQueryHistoryElementsShown(1, 2);

    await loadMoreQueryHistory();
    await assertQueryHistory(['{"expr":"query"}', '{"expr":"query"}']);

    assertLoadMoreQueryHistoryNotVisible();
  });
});
