import { setupExplore, waitForExplore } from './helper/setup';
import { inputQuery, openQueryHistory, runQuery } from './helper/interactions';
import { assertQueryHistoryExists } from './helper/assert';
import { makeLogsQueryResponse } from './helper/query';

describe('Explore: Query History', () => {
  const USER_INPUT = 'my query';
  const RAW_QUERY = `{"expr":"${USER_INPUT}"}`;

  it('adds new query history items after the query is run.', async () => {
    // when Explore is opened
    const { datasources, unmount } = setupExplore();
    (datasources.loki.query as jest.Mock).mockReturnValueOnce(makeLogsQueryResponse());
    await waitForExplore();

    // and a user runs a query and opens query history
    inputQuery(USER_INPUT);
    runQuery();
    await openQueryHistory();

    // the query that was run is in query history
    assertQueryHistoryExists(RAW_QUERY);

    // when Explore is opened again
    unmount();
    setupExplore({ clearLocalStorage: false });
    await waitForExplore();

    // previously added query is in query history
    await openQueryHistory();
    assertQueryHistoryExists(RAW_QUERY);
  });
});
