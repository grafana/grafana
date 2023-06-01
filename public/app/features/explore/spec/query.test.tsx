import { act, screen } from '@testing-library/react';

import { serializeStateToUrlParam } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { makeLogsQueryResponse, makeMetricsQueryResponse } from './helper/query';
import { setupExplore, tearDown, waitForExplore } from './helper/setup';

describe('Explore: handle running/not running query', () => {
  afterEach(() => {
    tearDown();
  });
  it('inits url and renders editor but does not call query on empty url', async () => {
    const { datasources } = setupExplore();
    await waitForExplore();

    // At this point url should be initialised to some defaults
    expect(locationService.getSearchObject()).toEqual({
      orgId: '1',
      left: serializeStateToUrlParam({
        datasource: 'loki-uid',
        queries: [{ refId: 'A', datasource: { type: 'logs', uid: 'loki-uid' } }],
        range: { from: 'now-1h', to: 'now' },
      }),
    });
    expect(datasources.loki.query).not.toBeCalled();
  });

  it('runs query when url contains query and renders results', async () => {
    const urlParams = {
      left: serializeStateToUrlParam({
        datasource: 'loki-uid',
        queries: [{ refId: 'A', expr: '{ label="value"}' }],
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

    // We did not change the url
    expect(locationService.getSearchObject()).toEqual({
      orgId: '1',
      ...urlParams,
    });

    // We called the data source query method once
    expect(datasources.loki.query).toBeCalledTimes(1);
    expect(jest.mocked(datasources.loki.query).mock.calls[0][0]).toMatchObject({
      targets: [{ expr: '{ label="value"}' }],
    });
  });

  describe('handles url change', () => {
    const urlParams = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]) };

    it('and runs the new query', async () => {
      const { datasources } = setupExplore({ urlParams });
      jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
      // Wait for rendering the logs
      await screen.findByText(/custom log line/i);

      jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse('different log'));

      act(() => {
        locationService.partial({
          left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="different"}' }]),
        });
      });

      // Editor renders the new query
      await screen.findByText(`loki Editor input: { label="different"}`);
      // Renders new response
      await screen.findByText(/different log/i);
    });

    it('and runs the new query with different datasource', async () => {
      const { datasources } = setupExplore({ urlParams });
      jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
      // Wait for rendering the logs
      await screen.findByText(/custom log line/i);
      await screen.findByText(`loki Editor input: { label="value"}`);

      jest.mocked(datasources.elastic.query).mockReturnValueOnce(makeMetricsQueryResponse());

      act(() => {
        locationService.partial({
          left: JSON.stringify(['now-1h', 'now', 'elastic', { expr: 'other query' }]),
        });
      });

      // Editor renders the new query
      await screen.findByText(`elastic Editor input: other query`);
      // Renders graph
      await screen.findByText(/Graph/i);
    });
  });
});
