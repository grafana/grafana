import { screen, waitFor } from '@testing-library/react';

import { serializeStateToUrlParam } from '@grafana/data';

import { changeDatasource } from './helper/interactions';
import { makeLogsQueryResponse } from './helper/query';
import { setupExplore, tearDown, waitForExplore } from './helper/setup';

describe('Explore: handle datasource states', () => {
  afterEach(() => {
    tearDown();
  });
  it('shows warning if there are no data sources', async () => {
    setupExplore({ datasources: [] });
    await waitFor(() => screen.getByText(/Explore requires at least one data source/i));
  });

  it('handles changing the datasource manually', async () => {
    const urlParams = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}', refId: 'A' }]) };
    const { datasources, location } = setupExplore({ urlParams });
    jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
    await waitForExplore();
    await changeDatasource('elastic');

    await screen.findByText('elastic Editor input:');
    expect(datasources.elastic.query).not.toBeCalled();

    await waitFor(async () => {
      expect(location.getSearchObject()).toEqual({
        orgId: '1',
        left: serializeStateToUrlParam({
          datasource: 'elastic-uid',
          queries: [{ refId: 'A', datasource: { type: 'logs', uid: 'elastic-uid' } }],
          range: { from: 'now-1h', to: 'now' },
        }),
      });
    });
  });
});
