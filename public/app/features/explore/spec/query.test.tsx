import { screen } from '@testing-library/react';

import { serializeStateToUrlParam } from '@grafana/data';

import { makeLogsQueryResponse } from './helper/query';
import { setupExplore, tearDown, waitForExplore } from './helper/setup';

jest.mock('../../correlations/utils', () => {
  return {
    getCorrelationsBySourceUIDs: jest.fn().mockReturnValue({ correlations: [] }),
  };
});

describe('Explore: handle running/not running query', () => {
  afterEach(() => {
    tearDown();
  });
  it('inits and renders editor but does not call query on empty initial state', async () => {
    const { datasources } = setupExplore();
    await waitForExplore();

    expect(datasources.loki.query).not.toBeCalled();
  });

  it('runs query when initial state contains query and renders results', async () => {
    const urlParams = {
      left: serializeStateToUrlParam({
        datasource: 'loki-uid',
        queries: [{ refId: 'A', expr: '{ label="value"}', datasource: { type: 'logs', uid: 'loki-uid' } }],
        range: { from: 'now-1h', to: 'now' },
      }),
    };
    const { datasources } = setupExplore({ urlParams });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());

    // Make sure we render the logs panel
    await screen.findByText(/^Logs$/);

    // Make sure we render the log line
    await screen.findByText(/custom log line/i);

    // And that the editor gets the expr from the url
    await screen.findByText(`loki Editor input: { label="value"}`);

    // We called the data source query method once
    expect(datasources.loki.query).toBeCalledTimes(1);
    expect(jest.mocked(datasources.loki.query).mock.calls[0][0]).toMatchObject({
      targets: [{ expr: '{ label="value"}' }],
    });
  });
});
